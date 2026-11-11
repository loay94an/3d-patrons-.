import type { GarmentLandmark, GarmentVisionResult } from './garment-vision';

export interface GarmentImageScaleCalibration {
  method: 'two-landmark-reference';
  referenceLandmarks: [string, string];
  referenceDistanceCm: number;
  pixelsPerCm: number;
  imageWidth: number;
  imageHeight: number;
}

export interface GarmentScaleIssue {
  path: string;
  message: string;
}

export interface GarmentScaleResult<T> {
  value: T | null;
  issues: GarmentScaleIssue[];
}

function findVisibleLandmark(
  landmarks: readonly GarmentLandmark[],
  name: string,
  path: string,
  issues: GarmentScaleIssue[]
): GarmentLandmark | null {
  const landmark = landmarks.find(item => item.name === name);
  if (!landmark) {
    issues.push({ path, message: 'Landmark was not found in the annotation' });
    return null;
  }
  if (!landmark.point || landmark.visibility !== 'visible') {
    issues.push({ path, message: 'Landmark must have a visible, placed point' });
    return null;
  }
  return landmark;
}

function pixelDistance(
  a: GarmentLandmark,
  b: GarmentLandmark,
  width: number,
  height: number
): number {
  const dx = (b.point!.x - a.point!.x) * width;
  const dy = (b.point!.y - a.point!.y) * height;
  return Math.hypot(dx, dy);
}

/**
 * Establishes a single image-plane scale from a known physical distance
 * between two manually verified visible landmarks.
 *
 * This is a 2D image-plane calibration. It does not correct perspective,
 * lens distortion, garment depth, or differences in the plane of the reference.
 */
export function calibrateGarmentImageScale(
  result: GarmentVisionResult,
  reference: {
    landmarkA: string;
    landmarkB: string;
    distanceCm: number;
  }
): GarmentScaleResult<GarmentImageScaleCalibration> {
  const issues: GarmentScaleIssue[] = [];
  const image = result?.image;
  if (!image || !Number.isInteger(image.processedWidth) || image.processedWidth <= 0 ||
      !Number.isInteger(image.processedHeight) || image.processedHeight <= 0) {
    issues.push({ path: 'image', message: 'Valid processed image dimensions are required' });
  }
  if (!Number.isFinite(reference?.distanceCm) || reference.distanceCm <= 0) {
    issues.push({ path: 'distanceCm', message: 'Reference distance must be a positive finite value in cm' });
  }
  if (!reference?.landmarkA || !reference?.landmarkB ||
      reference.landmarkA === reference.landmarkB) {
    issues.push({ path: 'referenceLandmarks', message: 'Choose two different named landmarks' });
  }
  if (issues.length) return { value: null, issues };

  const a = findVisibleLandmark(result.landmarks, reference.landmarkA, 'landmarkA', issues);
  const b = findVisibleLandmark(result.landmarks, reference.landmarkB, 'landmarkB', issues);
  if (!a || !b) return { value: null, issues };

  const pixels = pixelDistance(a, b, image.processedWidth, image.processedHeight);
  if (!Number.isFinite(pixels) || pixels < 1) {
    return {
      value: null,
      issues: [{ path: 'referenceLandmarks', message: 'Reference points must be at least one image pixel apart' }]
    };
  }

  return {
    value: {
      method: 'two-landmark-reference',
      referenceLandmarks: [reference.landmarkA, reference.landmarkB],
      referenceDistanceCm: reference.distanceCm,
      pixelsPerCm: pixels / reference.distanceCm,
      imageWidth: image.processedWidth,
      imageHeight: image.processedHeight
    },
    issues: []
  };
}

/**
 * Measures the straight-line distance between two visible image landmarks
 * using a calibration created for this exact processed image size.
 */
export function measureGarmentLandmarkDistanceCm(
  result: GarmentVisionResult,
  calibration: GarmentImageScaleCalibration,
  landmarkA: string,
  landmarkB: string
): GarmentScaleResult<number> {
  const issues: GarmentScaleIssue[] = [];
  if (!calibration || !Number.isFinite(calibration.pixelsPerCm) ||
      calibration.pixelsPerCm <= 0) {
    return { value: null, issues: [{ path: 'calibration', message: 'A valid image scale calibration is required' }] };
  }
  if (result.image.processedWidth !== calibration.imageWidth ||
      result.image.processedHeight !== calibration.imageHeight) {
    return { value: null, issues: [{ path: 'calibration', message: 'Calibration dimensions do not match this processed image' }] };
  }
  if (!landmarkA || !landmarkB || landmarkA === landmarkB) {
    return { value: null, issues: [{ path: 'landmarks', message: 'Choose two different named landmarks' }] };
  }

  const a = findVisibleLandmark(result.landmarks, landmarkA, 'landmarkA', issues);
  const b = findVisibleLandmark(result.landmarks, landmarkB, 'landmarkB', issues);
  if (!a || !b) return { value: null, issues };

  const pixels = pixelDistance(a, b, calibration.imageWidth, calibration.imageHeight);
  const value = pixels / calibration.pixelsPerCm;
  if (!Number.isFinite(value)) {
    return { value: null, issues: [{ path: 'measurement', message: 'Could not calculate a finite distance' }] };
  }
  return { value, issues: [] };
}
