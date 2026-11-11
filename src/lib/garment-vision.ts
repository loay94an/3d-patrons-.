/**
 * Stable, model-agnostic contract for 2D garment understanding.
 *
 * Coordinates are normalized to the image dimensions unless stated otherwise.
 * This module deliberately contains no inference code or dataset-specific model.
 */

export const GARMENT_VISION_SCHEMA_VERSION = 1 as const;

export type GarmentCategory =
  | 'blouse'
  | 'dress'
  | 'outwear'
  | 'skirt'
  | 'trousers'
  | 'unknown';

export type LandmarkVisibility = 'visible' | 'occluded' | 'not_present' | 'unknown';

export interface Point2D {
  /** Horizontal coordinate in normalized image space [0, 1]. */
  x: number;
  /** Vertical coordinate in normalized image space [0, 1]. */
  y: number;
}

export interface NormalizedBoundingBox {
  /** Left edge in normalized image space [0, 1]. */
  x: number;
  /** Top edge in normalized image space [0, 1]. */
  y: number;
  /** Width as a fraction of image width. */
  width: number;
  /** Height as a fraction of image height. */
  height: number;
}

export interface GarmentLandmark {
  /** Stable canonical key, not a dataset-specific numeric index. */
  name: string;
  point: Point2D | null;
  visibility: LandmarkVisibility;
  /** Model confidence in [0, 1]; null when unavailable. */
  confidence: number | null;
  /** Original dataset/model key when mapped from an external schema. */
  sourceKey?: string;
}

export interface GarmentMask {
  /** Dimensions of the raster mask or polygon coordinate canvas. */
  width: number;
  height: number;
  encoding: 'polygon';
  /** Each polygon is an ordered ring of normalized points. */
  polygons: Point2D[][];
}

export interface GarmentImageMetadata {
  /** Dimensions of the user's original image in pixels. */
  originalWidth: number;
  originalHeight: number;
  /** Dimensions presented to the vision model in pixels. */
  processedWidth: number;
  processedHeight: number;
  /** Model/provider identifier; descriptive only, no runtime dependency. */
  model: string;
  modelVersion: string;
  /** Dataset/keypoint schema used by the adapter, e.g. deepfashion2-v1. */
  landmarkSchema: string;
}

export interface GarmentVisionResult {
  schemaVersion: typeof GARMENT_VISION_SCHEMA_VERSION;
  category: GarmentCategory;
  /** Garment bounds normalized to the processed image. */
  boundingBox: NormalizedBoundingBox;
  /** Optional polygon mask normalized to the processed image. */
  mask: GarmentMask | null;
  /** Canonical, named landmarks normalized to the processed image. */
  landmarks: GarmentLandmark[];
  /** Detection confidence in [0, 1]. */
  confidence: number;
  image: GarmentImageMetadata;
}

export interface ImageCoordinateTransform {
  /**
   * Affine mapping from original normalized coordinates to processed
   * normalized coordinates:
   * processed = (flip ? 1 - original : original) * scale + offset.
   * Crop/pad offsets are represented by offsetX/offsetY.
   */
  scaleX: number;
  scaleY: number;
  offsetX: number;
  offsetY: number;
  flipX: boolean;
  flipY: boolean;
}

export interface GarmentVisionIssue {
  path: string;
  message: string;
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isUnitInterval = (value: unknown): value is number =>
  isFiniteNumber(value) && value >= 0 && value <= 1;

function assertValidTransform(transform: ImageCoordinateTransform): void {
  if (
    !isFiniteNumber(transform.scaleX) ||
    !isFiniteNumber(transform.scaleY) ||
    transform.scaleX <= 0 ||
    transform.scaleY <= 0 ||
    !isFiniteNumber(transform.offsetX) ||
    !isFiniteNumber(transform.offsetY) ||
    typeof transform.flipX !== 'boolean' ||
    typeof transform.flipY !== 'boolean'
  ) {
    throw new Error('Image transform must contain positive finite scales, finite offsets, and boolean flips');
  }
}

/** Map a point from the original image into the processed/model image. */
export function transformPointToProcessed(
  point: Point2D,
  transform: ImageCoordinateTransform
): Point2D {
  assertValidPoint(point, 'point');
  assertValidTransform(transform);
  const x = transform.flipX ? 1 - point.x : point.x;
  const y = transform.flipY ? 1 - point.y : point.y;
  return {
    x: x * transform.scaleX + transform.offsetX,
    y: y * transform.scaleY + transform.offsetY
  };
}

/** Map a processed/model point back into the original image coordinate space. */
export function transformPointToOriginal(
  point: Point2D,
  transform: ImageCoordinateTransform
): Point2D {
  if (!isFiniteNumber(point.x) || !isFiniteNumber(point.y)) {
    throw new Error('Processed point coordinates must be finite');
  }
  assertValidTransform(transform);
  const x = (point.x - transform.offsetX) / transform.scaleX;
  const y = (point.y - transform.offsetY) / transform.scaleY;
  return {
    x: transform.flipX ? 1 - x : x,
    y: transform.flipY ? 1 - y : y
  };
}

function assertValidPoint(point: Point2D, label: string): void {
  if (!point || !isUnitInterval(point.x) || !isUnitInterval(point.y)) {
    throw new Error(label + ' must use finite normalized coordinates in [0, 1]');
  }
}

/**
 * Validate a serialized result before storing it or passing it to CAD.
 * This checks structural integrity only; it does not certify model accuracy.
 */
export function validateGarmentVisionResult(
  result: GarmentVisionResult
): GarmentVisionIssue[] {
  const issues: GarmentVisionIssue[] = [];
  const add = (path: string, message: string) => issues.push({ path, message });

  if (!result || typeof result !== 'object') {
    return [{ path: 'result', message: 'Result must be an object' }];
  }
  if (result.schemaVersion !== GARMENT_VISION_SCHEMA_VERSION) {
    add('schemaVersion', 'Unsupported garment vision schema version');
  }
  const categories: GarmentCategory[] = [
    'blouse', 'dress', 'outwear', 'skirt', 'trousers', 'unknown'
  ];
  if (!categories.includes(result.category)) add('category', 'Unknown garment category');
  if (!isUnitInterval(result.confidence)) add('confidence', 'Confidence must be in [0, 1]');

  const box = result.boundingBox;
  if (!box || !isUnitInterval(box.x) || !isUnitInterval(box.y) ||
      !isFiniteNumber(box.width) || !isFiniteNumber(box.height) ||
      box.width <= 0 || box.height <= 0 ||
      box.x + box.width > 1 || box.y + box.height > 1) {
    add('boundingBox', 'Bounding box must be positive and contained in normalized image space');
  }

  const image = result.image;
  if (!image || ![image.originalWidth, image.originalHeight, image.processedWidth,
    image.processedHeight].every(value => Number.isInteger(value) && value > 0)) {
    add('image', 'Image dimensions must be positive integers');
  }
  if (!image || ![image.model, image.modelVersion, image.landmarkSchema]
    .every(value => typeof value === 'string' && value.trim().length > 0)) {
    add('image.model', 'Model, modelVersion, and landmarkSchema are required');
  }

  if (!Array.isArray(result.landmarks)) {
    add('landmarks', 'Landmarks must be an array');
  } else {
    const names = new Set<string>();
    result.landmarks.forEach((landmark, index) => {
      const path = 'landmarks[' + index + ']';
      if (!landmark || typeof landmark.name !== 'string' || !landmark.name.trim()) {
        add(path + '.name', 'Landmark name is required');
        return;
      }
      if (names.has(landmark.name)) add(path + '.name', 'Landmark names must be unique');
      names.add(landmark.name);
      if (!['visible', 'occluded', 'not_present', 'unknown'].includes(landmark.visibility)) {
        add(path + '.visibility', 'Unsupported visibility value');
      }
      if (landmark.point !== null) {
        try {
          assertValidPoint(landmark.point, path + '.point');
        } catch (error) {
          add(path + '.point', error instanceof Error ? error.message : 'Invalid point');
        }
      } else if (landmark.visibility === 'visible') {
        add(path + '.point', 'Visible landmarks must include a point');
      }
      if (landmark.confidence !== null && !isUnitInterval(landmark.confidence)) {
        add(path + '.confidence', 'Landmark confidence must be null or in [0, 1]');
      }
    });
  }

  if (result.mask !== null) {
    const mask = result.mask;
    if (!mask || !Number.isInteger(mask.width) || mask.width <= 0 ||
        !Number.isInteger(mask.height) || mask.height <= 0 ||
        mask.encoding !== 'polygon' || !Array.isArray(mask.polygons)) {
      add('mask', 'Mask must be a valid polygon mask with positive dimensions');
    } else {
      mask.polygons.forEach((polygon, polygonIndex) => {
        if (!Array.isArray(polygon) || polygon.length < 3) {
          add('mask.polygons[' + polygonIndex + ']', 'Each polygon needs at least three points');
          return;
        }
        polygon.forEach((point, pointIndex) => {
          try {
            assertValidPoint(point, 'mask point');
          } catch {
            add('mask.polygons[' + polygonIndex + '][' + pointIndex + ']', 'Mask points must be normalized to [0, 1]');
          }
        });
      });
    }
  }

  return issues;
}

/**
 * Explicit canonical names shared across adapters. Dataset-specific indices
 * must be translated by an adapter and must never be assumed to align.
 */
export const GARMENT_LANDMARK_NAMES = {
  blouse: ['neck_left', 'neck_right', 'shoulder_left', 'shoulder_right',
    'armpit_left', 'armpit_right', 'waist_left', 'waist_right', 'hem_left', 'hem_right'],
  outwear: ['neck_left', 'neck_right', 'shoulder_left', 'shoulder_right',
    'sleeve_left', 'sleeve_right', 'cuff_left', 'cuff_right', 'hem_left', 'hem_right'],
  trousers: ['waist_left', 'waist_right', 'crotch', 'knee_left', 'knee_right',
    'hem_left', 'hem_right'],
  skirt: ['waist_left', 'waist_right', 'hem_left', 'hem_right'],
  dress: ['neck_left', 'neck_right', 'shoulder_left', 'shoulder_right',
    'waist_left', 'waist_right', 'hem_left', 'hem_right']
} as const;
