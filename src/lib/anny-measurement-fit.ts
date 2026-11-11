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
