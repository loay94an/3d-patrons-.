import {
  GARMENT_LANDMARK_NAMES,
  type GarmentCategory,
  type GarmentLandmark,
  type LandmarkVisibility
} from './garment-vision';

export type SourceCoordinateSpace = 'pixel' | 'normalized';
export type SourceKeypoint = {
  x: number;
  y: number;
  key?: string;
  visibility?: LandmarkVisibility | number;
  confidence?: number | null;
};

export interface GarmentLandmarkAdapterInput {
  sourceSchema: string;
  /** Schemas explicitly enabled by the caller; unknown datasets are rejected. */
  knownSourceSchemas: readonly string[];
  category: Exclude<GarmentCategory, 'unknown'>;
  processedWidth: number;
  processedHeight: number;
  coordinateSpace: SourceCoordinateSpace;
  keypoints: readonly (SourceKeypoint | null | undefined)[];
  /** Canonical landmark name -> source array index OR exact source key. */
  keypointMap: Readonly<Record<string, number | string>>;
  /** Required only when the source uses numeric visibility codes. */
  visibilityMap?: Readonly<Record<number, LandmarkVisibility>>;
  confidence?: number | null;
}

export interface GarmentLandmarkAdapterIssue {
  path: string;
  message: string;
}

export interface GarmentLandmarkAdapterResult {
  landmarks: GarmentLandmark[];
  issues: GarmentLandmarkAdapterIssue[];
}

const VISIBILITIES: readonly LandmarkVisibility[] = [
  'visible', 'occluded', 'not_present', 'unknown'
];

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isUnitInterval = (value: unknown): value is number =>
  isFiniteNumber(value) && value >= 0 && value <= 1;

/**
 * Converts source keypoints into the app's canonical landmark vocabulary.
 * Dataset index order is never inferred: keypointMap must be supplied explicitly.
 */
export function adaptGarmentLandmarks(
  input: GarmentLandmarkAdapterInput
): GarmentLandmarkAdapterResult {
  const issues: GarmentLandmarkAdapterIssue[] = [];
  const add = (path: string, message: string) => issues.push({ path, message });

  if (!input || typeof input !== 'object') {
    return { landmarks: [], issues: [{ path: 'input', message: 'Input must be an object' }] };
  }

  if (!input.sourceSchema || !input.knownSourceSchemas.includes(input.sourceSchema)) {
    add('sourceSchema', 'Source schema is not explicitly enabled');
  }
  if (!input.category || !(input.category in GARMENT_LANDMARK_NAMES)) {
    add('category', 'Unsupported garment category');
  }
  if (!Number.isInteger(input.processedWidth) || input.processedWidth <= 0 ||
      !Number.isInteger(input.processedHeight) || input.processedHeight <= 0) {
    add('image', 'Processed image dimensions must be positive integers');
  }
  if (input.coordinateSpace !== 'pixel' && input.coordinateSpace !== 'normalized') {
    add('coordinateSpace', 'Coordinate space must be pixel or normalized');
  }
  if (!Array.isArray(input.keypoints)) add('keypoints', 'Keypoints must be an array');
  if (!input.keypointMap || typeof input.keypointMap !== 'object') {
    add('keypointMap', 'An explicit canonical-to-source keypoint map is required');
  }
  if (input.confidence !== undefined && input.confidence !== null &&
      !isUnitInterval(input.confidence)) {
    add('confidence', 'Global confidence must be null or in [0, 1]');
  }

  const categoryIsValid = input.category in GARMENT_LANDMARK_NAMES;
  const names = categoryIsValid
    ? GARMENT_LANDMARK_NAMES[input.category]
    : [];
  const landmarks: GarmentLandmark[] = names.map((name) => {
    const sourceReference = input.keypointMap?.[name];
    if (sourceReference === undefined) {
      add('keypointMap.' + name, 'No explicit source mapping; landmark left unknown');
      return { name, point: null, visibility: 'unknown', confidence: null };
    }

    let sourceIndex = -1;
    let sourceKey: string | undefined;
    if (typeof sourceReference === 'number' && Number.isInteger(sourceReference) &&
        sourceReference >= 0) {
      sourceIndex = sourceReference;
    } else if (typeof sourceReference === 'string' && sourceReference.length > 0) {
      sourceKey = sourceReference;
      sourceIndex = input.keypoints.findIndex((point) => point?.key === sourceReference);
    } else {
      add('keypointMap.' + name, 'Mapping must be a non-negative index or exact source key');
      return { name, point: null, visibility: 'unknown', confidence: null };
    }

    const source = input.keypoints[sourceIndex];
    if (!source) {
      add('keypoints.' + String(sourceReference), 'Mapped source keypoint is missing');
      return { name, point: null, visibility: 'unknown', confidence: null,
        ...(sourceKey ? { sourceKey } : {}) };
    }

    let visibility: LandmarkVisibility = 'unknown';
    if (typeof source.visibility === 'number') {
      const mapped = input.visibilityMap?.[source.visibility];
      if (!mapped || !VISIBILITIES.includes(mapped)) {
        add('keypoints.' + String(sourceReference) + '.visibility',
          'Numeric visibility code has no valid explicit mapping');
      } else {
        visibility = mapped;
      }
    } else if (source.visibility !== undefined) {
      if (VISIBILITIES.includes(source.visibility as LandmarkVisibility)) {
        visibility = source.visibility as LandmarkVisibility;
      } else {
        add('keypoints.' + String(sourceReference) + '.visibility',
          'Unsupported visibility value');
      }
    }

    const confidence = source.confidence === undefined
      ? (input.confidence ?? null)
      : source.confidence;
    if (confidence !== null && !isUnitInterval(confidence)) {
      add('keypoints.' + String(sourceReference) + '.confidence',
        'Confidence must be null or in [0, 1]');
    }

    if (visibility === 'not_present') {
      return { name, point: null, visibility, confidence: isUnitInterval(confidence) ? confidence : null,
        ...(sourceKey ? { sourceKey } : {}) };
    }

    if (!isFiniteNumber(source.x) || !isFiniteNumber(source.y)) {
      add('keypoints.' + String(sourceReference), 'Coordinates must be finite numbers');
      return { name, point: null, visibility: 'unknown',
        confidence: isUnitInterval(confidence) ? confidence : null,
        ...(sourceKey ? { sourceKey } : {}) };
    }

    const point = input.coordinateSpace === 'pixel'
      ? { x: source.x / input.processedWidth, y: source.y / input.processedHeight }
      : { x: source.x, y: source.y };

    if (!isUnitInterval(point.x) || !isUnitInterval(point.y)) {
      add('keypoints.' + String(sourceReference),
        'Converted coordinates fall outside normalized image bounds [0, 1]');
      return { name, point: null, visibility: 'unknown',
        confidence: isUnitInterval(confidence) ? confidence : null,
        ...(sourceKey ? { sourceKey } : {}) };
    }

    return {
      name,
      point,
      visibility,
      confidence: isUnitInterval(confidence) ? confidence : null,
      ...(sourceKey ? { sourceKey } : {})
    };
  });

  return { landmarks, issues };
}
