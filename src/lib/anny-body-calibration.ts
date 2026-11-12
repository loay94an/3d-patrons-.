import * as THREE from 'three';
import { measureMeshSectionCircumference } from './mesh-anthropometry';

export interface AnnyBodyCalibrationTargets {
  heightCm: number;
  bustCm: number;
  waistCm: number;
  hipCm: number;
}

export interface AnnyBodyCalibrationLandmark {
  zone: 'hip' | 'waist' | 'bust';
  heightFraction: number;
  nativeCircumference: number;
  targetCircumferenceCm: number;
  radialScaleRequested: number;
  radialScaleApplied: number;
  predictedCircumferenceCm: number;
  residualCm: number;
}

export interface AnnyBodyCalibrationResult {
  geometry: THREE.BufferGeometry;
  nativeHeight: number;
  targetHeightCm: number;
  heightScale: number;
  landmarks: AnnyBodyCalibrationLandmark[];
  status: 'calibrated-preview' | 'limited-preview' | 'review-required';
  warnings: string[];
}

const SAMPLE_COUNT = 121;
const MIN_RADIAL_SCALE = 0.75;
const MAX_RADIAL_SCALE = 1.25;
const smoothstep = (value: number, low: number, high: number) => {
  const t = THREE.MathUtils.clamp((value - low) / (high - low), 0, 1);
  return t * t * (3 - 2 * t);
};

function findProfileCandidate(
  samples: Array<{ fraction: number; circumference: number }>,
  start: number,
  end: number,
  mode: 'min' | 'max'
) {
  const candidates = samples.filter(sample => sample.fraction >= start && sample.fraction <= end);
  if (!candidates.length) throw new Error('Anny mesh has no measurable torso section in a required landmark band');
  return candidates.reduce((best, sample) =>
    mode === 'max'
      ? sample.circumference > best.circumference ? sample : best
      : sample.circumference < best.circumference ? sample : best
  );
}

function radialScaleAt(fraction: number, anchors: Array<{ fraction: number; scale: number }>) {
  if (fraction <= anchors[0].fraction) return anchors[0].scale;
  if (fraction >= anchors[anchors.length - 1].fraction) return anchors[anchors.length - 1].scale;
  const upperIndex = anchors.findIndex(anchor => anchor.fraction >= fraction);
  const lower = anchors[upperIndex - 1];
  const upper = anchors[upperIndex];
  const t = smoothstep(fraction, lower.fraction, upper.fraction);
  return THREE.MathUtils.lerp(lower.scale, upper.scale, t);
}

/**
 * Creates a centimetre-height-normalized, tape-guided Anny preview geometry.
 * Bust/waist/hip locations are estimated from section extrema and therefore
 * remain review-only until visually checked against anatomical landmarks.
 * Radial deformation is bounded to avoid extreme mesh distortion.
 */
export function calibrateAnnyBodyGeometry(
  source: THREE.BufferGeometry,
  targets: AnnyBodyCalibrationTargets
): AnnyBodyCalibrationResult {
  if (![targets.heightCm, targets.bustCm, targets.waistCm, targets.hipCm].every(Number.isFinite) ||
      targets.heightCm <= 0 || targets.bustCm <= 0 || targets.waistCm <= 0 || targets.hipCm <= 0) {
    throw new Error('Anny calibration requires positive finite height, bust, waist and hip measurements');
  }

  const geometry = source.clone();
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  const positions = geometry.getAttribute('position');
  if (!bounds || !positions || positions.count < 3) {
    geometry.dispose();
    throw new Error('Anny body geometry has no usable vertex bounds');
  }
  const height = bounds.max.z - bounds.min.z;
  const horizontalSpan = Math.max(bounds.max.x - bounds.min.x, bounds.max.y - bounds.min.y);
  if (!Number.isFinite(height) || height <= 0 || height < horizontalSpan * 1.2) {
    geometry.dispose();
    throw new Error('Anny body must use its documented Z-up vertical axis');
  }
  const heightScale = targets.heightCm / height;
  const samples: Array<{ fraction: number; circumference: number }> = [];
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const fraction = THREE.MathUtils.lerp(0.08, 0.94, i / (SAMPLE_COUNT - 1));
    const coordinate = bounds.min.z + fraction * height;
    try {
      samples.push({ fraction, circumference: measureMeshSectionCircumference(geometry, 'z', coordinate) });
    } catch {
      // Open sections (for example through the neck or joints) are omitted.
    }
  }

  if (samples.length < 12) {
    geometry.dispose();
    throw new Error('Anny body has too few closed horizontal sections for calibration');
  }

  const hip = findProfileCandidate(samples, 0.30, 0.58, 'max');
  const waist = findProfileCandidate(samples, 0.48, 0.72, 'min');
  const bust = findProfileCandidate(samples, 0.64, 0.86, 'max');
  if (!(hip.fraction < waist.fraction && waist.fraction < bust.fraction)) {
    geometry.dispose();
    throw new Error('Anny section extrema do not form an ordered hip-waist-bust profile; calibration was not applied');
  }

  const raw = [
    { zone: 'hip' as const, sample: hip, target: targets.hipCm },
    { zone: 'waist' as const, sample: waist, target: targets.waistCm },
    { zone: 'bust' as const, sample: bust, target: targets.bustCm }
  ];
  const landmarks = raw.map(item => {
    const nativeCm = item.sample.circumference * heightScale;
    const requested = item.target / nativeCm;
    const applied = THREE.MathUtils.clamp(requested, MIN_RADIAL_SCALE, MAX_RADIAL_SCALE);
    return {
      zone: item.zone,
      heightFraction: item.sample.fraction,
      nativeCircumference: item.sample.circumference,
      targetCircumferenceCm: item.target,
      radialScaleRequested: requested,
      radialScaleApplied: applied,
      predictedCircumferenceCm: nativeCm * applied,
      residualCm: nativeCm * applied - item.target
    };
  });

  const warnings: string[] = [];
  if (landmarks.some(item => item.radialScaleRequested < MIN_RADIAL_SCALE || item.radialScaleRequested > MAX_RADIAL_SCALE)) {
    warnings.push('واحد أو أكثر من المحيطات يتطلب تغييراً أكبر من حد التشوه الآمن؛ طُبّق الحد الأقصى المسموح فقط');
  }
  if (samples.length < SAMPLE_COUNT * 0.65) {
    warnings.push('بعض المقاطع الأفقية غير مغلقة؛ راجع شكل الجسم من جميع الجهات');
  }

  const centerX = (bounds.min.x + bounds.max.x) / 2;
  const centerY = (bounds.min.y + bounds.max.y) / 2;
  const torsoRadiusAt = (fraction: number) => {
    const ordered = raw.map(item => ({ fraction: item.sample.fraction, radius: item.sample.circumference / (2 * Math.PI) }));
    if (fraction <= ordered[0].fraction) return ordered[0].radius;
    if (fraction >= ordered[2].fraction) return ordered[2].radius;
    const upperIndex = ordered.findIndex(item => item.fraction >= fraction);
    const lower = ordered[upperIndex - 1];
    const upper = ordered[upperIndex];
    return THREE.MathUtils.lerp(lower.radius, upper.radius,
      smoothstep(fraction, lower.fraction, upper.fraction));
  };
  const deformationAnchors = [
    { fraction: 0.08, scale: 1 },
    ...landmarks.map(item => ({ fraction: item.heightFraction, scale: item.radialScaleApplied })),
    { fraction: 0.94, scale: 1 }
  ].sort((a, b) => a.fraction - b.fraction);

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    const fraction = THREE.MathUtils.clamp((z - bounds.min.z) / height, 0, 1);
    const scale = radialScaleAt(fraction, deformationAnchors);
    const torsoRadius = Math.max(torsoRadiusAt(fraction), 1e-6);
    const radialDistance = Math.hypot(x - centerX, y - centerY);
    // Keep distant arms/hands largely unchanged while fitting the central torso.
    const torsoWeight = 1 - smoothstep(radialDistance / torsoRadius, 1.05, 1.25);
    const effectiveScale = THREE.MathUtils.lerp(1, scale, torsoWeight);
    positions.setXYZ(i,
      centerX + (x - centerX) * effectiveScale,
      centerY + (y - centerY) * effectiveScale,
      z
    );
  }

  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  // Measure the deformed geometry again instead of reporting only the requested
  // scale ratio; torso-local weighting can make the achieved circumference differ.
  landmarks.forEach(item => {
    try {
      const coordinate = bounds.min.z + item.heightFraction * height;
      const measuredCm = measureMeshSectionCircumference(geometry, 'z', coordinate) * heightScale;
      item.predictedCircumferenceCm = measuredCm;
      item.residualCm = measuredCm - item.targetCircumferenceCm;
      if (Math.abs(item.residualCm) > 1) {
        warnings.push(`الفرق المتبقي في قياس ${item.zone} يتجاوز 1 سم بعد التشوه المحدود`);
      }
    } catch {
      warnings.push(`تعذر إعادة قياس مقطع ${item.zone} بعد المعايرة`);
    }
  });

  return {
    geometry,
    nativeHeight: height,
    targetHeightCm: targets.heightCm,
    heightScale,
    landmarks,
    status: warnings.length ? 'limited-preview' : 'calibrated-preview',
    warnings
  };
}
