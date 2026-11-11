import type { PatternByNumbersInput } from './pattern-cad-engine';

export type PatternGarmentFamily = 'bodice' | 'shirt' | 'dress' | 'pants' | 'sleeve' | 'skirt';

/** Map only measurements with matching physical meaning; never substitute bust-point height for full front waist length. */
export function mapMeasurementsToPatternInput(
  base: PatternByNumbersInput,
  measurements: Record<string, number>,
  garment: PatternGarmentFamily
): PatternByNumbersInput {
  const read = (...keys: string[]): number | undefined => {
    for (const key of keys) {
      const value = measurements[key];
      if (Number.isFinite(value) && value > 0) return value;
    }
    return undefined;
  };
  const next: PatternByNumbersInput = { ...base };
  const assign = (key: keyof PatternByNumbersInput, value: number | undefined) => {
    if (value !== undefined) (next as unknown as Record<string, number>)[key] = value;
  };

  assign('bustCircumference', read('bust', 'chest'));
  assign('waistCircumference', read('waist'));
  assign('hipCircumference', read('hip'));
  assign('shoulderLength', read('shoulder', 'shoulderLength'));
  assign('neckCircumference', read('neckCirc', 'neckCircumference'));
  assign('neckDepthFront', read('neckDepthFront', 'frontNeckDepth'));
  assign('neckDepthBack', read('neckDepthBack', 'backNeckDepth'));
  assign('armholeCircumference', read('armholeCirc', 'armholeCircumference'));
  assign('upperArmCircumference', read('armCirc', 'upperArm', 'upperArmCircumference'));
  assign('sleeveLength', read('sleeveLength'));
  assign('thighCircumference', read('thighCirc', 'thighCircumference'));
  assign('crotchDepth', read('crotchHeight', 'crotchDepth'));
  assign('hipDepth', read('waistToHip', 'hipDepth'));
  assign('waistToKnee', read('waistToKnee'));
  assign('frontLength', read('frontLength', 'frontWaistLength'));
  assign('seamAllowanceDefault', read('seamAllowanceDefault', 'seamAllowance'));

  if (garment === 'pants') {
    // The trouser block uses waist-to-hem length; torso back length is not a valid substitute.
    assign('backLength', read('legLength', 'sideLength', 'pantLength'));
  } else if (garment === 'skirt' || garment === 'dress') {
    assign('backLength', read('skirtLength', 'garmentLength', 'backLength'));
  } else {
    assign('backLength', read('backLength'));
  }
  return next;
}
