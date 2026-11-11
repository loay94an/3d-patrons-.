import type { PatternByNumbersInput } from './pattern-cad-engine';

export type PatternGarmentFamily = 'bodice' | 'shirt' | 'dress' | 'pants' | 'sleeve' | 'skirt';

/** Maps canonical measurement names and the legacy profile keys into CAD engine inputs. */
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
  const next = { ...base };
  const assign = (key: keyof PatternByNumbersInput, value: number | undefined) => {
    if (value !== undefined) next[key] = value;
  };

  assign('bustCircumference', read('bust', 'chest'));
  assign('waistCircumference', read('waist'));
  assign('hipCircumference', read('hip'));
  assign('frontLength', read('chestLength', 'frontLength'));
  assign('shoulderLength', read('shoulder', 'shoulderLength'));
  assign('neckCircumference', read('neckCirc', 'neckCircumference'));
  assign('neckDepthFront', read('neckDepthFront', 'frontNeckDepth'));
  assign('neckDepthBack', read('neckDepthBack', 'backNeckDepth'));
  assign('armholeCircumference', read('armholeCirc', 'armholeCircumference'));
  assign('upperArmCircumference', read('armCirc', 'upperArm', 'upperArmCircumference'));
  assign('sleeveLength', read('sleeveLength'));
  assign('thighCircumference', read('thighCirc', 'thighCircumference'));
  assign('crotchDepth', read('crotchHeight', 'crotchDepth'));
  assign('rise', read('crotchHeight', 'rise'));

  if (garment === 'pants') {
    assign('backLength', read('legLength', 'sideLength', 'backLength'));
  } else if (garment === 'skirt') {
    assign('backLength', read('skirtLength', 'backLength'));
  } else {
    assign('backLength', read('backLength'));
  }
  assign('seamAllowanceDefault', read('seamAllowanceDefault', 'seamAllowance'));
  return next;
}
