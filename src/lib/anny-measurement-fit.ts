import { DEFAULT_MANNEQUIN_MEASUREMENTS } from './mannequin-builder';
import type { Gender } from './pattern-logic';

const MIN_BODY_HEIGHT_CM = 50;
const MAX_BODY_HEIGHT_CM = 250;

/**
 * Resolve the Anny preview height from the active pattern measurements.
 * This calibrates stature only; it does not claim that torso girths are fitted.
 */
export function resolveAnnyTargetHeightCm(
  gender: Gender,
  requestedHeight?: number
): number {
  if (
    Number.isFinite(requestedHeight) &&
    requestedHeight! >= MIN_BODY_HEIGHT_CM &&
    requestedHeight! <= MAX_BODY_HEIGHT_CM
  ) {
    return requestedHeight!;
  }
  return DEFAULT_MANNEQUIN_MEASUREMENTS[gender].height;
}

/** Convert Anny's native vertical extent to the requested preview height in cm. */
export function getAnnyHeightScale(nativeHeight: number, targetHeightCm: number): number {
  if (!Number.isFinite(nativeHeight) || nativeHeight <= 0) {
    throw new Error('Anny native height must be a positive finite value');
  }
  if (!Number.isFinite(targetHeightCm) || targetHeightCm <= 0) {
    throw new Error('Anny target height must be a positive finite value');
  }
  return targetHeightCm / nativeHeight;
}

/**
 * Convert a circumference measured in the unscaled Anny mesh into centimetres.
 * This is valid only when the mesh is uniformly scaled from its native height
 * to the supplied real-world stature. It does not identify anatomical landmarks
 * or make an unvalidated section suitable as a sewing measurement.
 */
export function convertAnnyCircumferenceToCm(
  nativeCircumference: number,
  nativeHeight: number,
  targetHeightCm: number
): number {
  if (!Number.isFinite(nativeCircumference) || nativeCircumference <= 0) {
    throw new Error('Anny native circumference must be a positive finite value');
  }
  return nativeCircumference * getAnnyHeightScale(nativeHeight, targetHeightCm);
}


export interface RadialScaleAnchor {
  coordinate: number;
  radialScale: number;
}

/**
 * Interpolate a conservative radial deformation factor between validated
 * anatomical anchors. Smoothstep avoids abrupt scale changes at each anchor.
 * This helper does not mutate geometry; callers must not use unvalidated
 * landmarks or apply the result until the body-axis mapping is established.
 */
export function interpolateRadialScale(
  coordinate: number,
  anchors: RadialScaleAnchor[],
  minScale = 0.85,
  maxScale = 1.15
): number {
  if (!Number.isFinite(coordinate)) throw new Error('Profile coordinate must be finite');
  if (!Number.isFinite(minScale) || !Number.isFinite(maxScale) ||
      minScale <= 0 || maxScale < minScale) {
    throw new Error('Radial scale bounds must be positive and ordered');
  }
  if (anchors.length < 2) throw new Error('At least two radial scale anchors are required');

  const sorted = [...anchors].sort((a, b) => a.coordinate - b.coordinate);
  for (let i = 0; i < sorted.length; i++) {
    const anchor = sorted[i];
    if (!Number.isFinite(anchor.coordinate) ||
        !Number.isFinite(anchor.radialScale) || anchor.radialScale <= 0) {
      throw new Error('Radial scale anchors must contain finite coordinates and positive scales');
    }
    if (i > 0 && anchor.coordinate <= sorted[i - 1].coordinate) {
      throw new Error('Radial scale anchor coordinates must be distinct');
    }
  }

  const clamp = (value: number) => Math.min(maxScale, Math.max(minScale, value));
  if (coordinate <= sorted[0].coordinate) return clamp(sorted[0].radialScale);
  if (coordinate >= sorted[sorted.length - 1].coordinate) {
    return clamp(sorted[sorted.length - 1].radialScale);
  }

  const upperIndex = sorted.findIndex(anchor => anchor.coordinate >= coordinate);
  const lower = sorted[upperIndex - 1];
  const upper = sorted[upperIndex];
  const t = (coordinate - lower.coordinate) / (upper.coordinate - lower.coordinate);
  const smoothT = t * t * (3 - 2 * t);
  const lowerScale = clamp(lower.radialScale);
  const upperScale = clamp(upper.radialScale);
  return lowerScale + (upperScale - lowerScale) * smoothT;
}
