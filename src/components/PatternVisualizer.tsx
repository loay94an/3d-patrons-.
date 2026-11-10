import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  ZoomIn, ZoomOut, RotateCcw, Download, Printer,
  Compass, Grid, Sliders, Layers, Eye, EyeOff,
  Copy, Check, FileText, Sparkles, Move, Scissors,
  Maximize2, Minimize2, Plus, Minus, ArrowUpRight, HelpCircle,
  Magnet, CheckCircle2, CheckCircle, Split, Wand2, Ruler, Lock, Unlock,
  ChevronRight, ChevronLeft, ChevronDown, ChevronUp, MousePointer, PenTool,
  RotateCw, Undo2, Redo2, Layers2, ArrowLeft, LayoutGrid, Focus, Crosshair,
  Trash2, CornerDownLeft, X, CircleDot, Zap
} from 'lucide-react';
import { AppState, GarmentType, getBaseMeasurements } from '../lib/pattern-logic';
import {
  CadPiece, CadSegment, CadPoint, CadNotch, CadGrainline,
  WorkFrameConfig, PatternByNumbersInput, DEFAULT_PATTERN_NUMBERS,
  DraftingRulesConfig, DEFAULT_DRAFTING_RULES,
  generatePatternByNumbers, segmentToSvgPath, pieceToClosedSvgPath, PieceSpecSummary,
  distance, angleBetween, midPoint, quadLength, bezierLength
} from '../lib/pattern-cad-engine';
import { CadSidePanel, CadActiveTool } from './CadSidePanel';
import { CadFloatingProperties } from './CadFloatingProperties';
import { PatternByNumbersModal } from './PatternByNumbersModal';
import { TilePrintModal } from './TilePrintModal';
import { CadHistoryModal, HistoryEntry } from './CadHistoryModal';

interface PatternVisualizerProps {
  state: AppState;
  onBackToCalculator?: () => void;
  /** Tells the app which garment is being drafted, so the 3D mannequin wears it. */
  onGarmentChange?: (garment: GarmentType) => void;
}

export function PatternVisualizer({ state, onBackToCalculator, onGarmentChange }: PatternVisualizerProps) {
  // Unit setup
  const isInch = state.unit === 'in';
  const unitLabel = isInch ? 'إنش' : 'سم';
  const cmToUser = (cm: number) => isInch ? cm / 2.54 : cm;
  const fmt = (cm: number) => `${cmToUser(cm).toFixed(1)} ${unitLabel}`;

  // Work Frame state (resizable width x height in cm)
  const [workFrame, setWorkFrame] = useState<WorkFrameConfig>({
    widthCm: 110,
    heightCm: 85,
    unit: state.unit
  });

  // Layer Visibility
  const [layers, setLayers] = useState({
    grid: true,
    rulers: true,
    cutting: true,
    stitch: true,
    seam: true,
    notches: true,
    notes: true,
    dimensions: true
  });

  // Active Garment Category
  const [activeGarmentType, setActiveGarmentType] = useState<'bodice' | 'shirt' | 'dress' | 'pants' | 'sleeve' | 'skirt'>('bodice');

  // Side Inspector Dock state (Docked on perimeter, collapsed by default on mobile)
  const [isInspectorOpen, setIsInspectorOpen] = useState(() => typeof window !== 'undefined' ? window.innerWidth >= 1280 : false);
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);
  const [showQuickProperties, setShowQuickProperties] = useState(false);
  const [showSpecsTable, setShowSpecsTable] = useState(false);

  // Pattern By Numbers Data State (16 fields)
  const [patternInputs, setPatternInputs] = useState<PatternByNumbersInput>(() => {
    return {
      backLength: state.customMeasurements.backLength ?? 60,
      frontLength: 62,
      shoulderLength: state.customMeasurements.shoulder ?? 12,
      neckCircumference: state.customMeasurements.neckCirc ?? 36,
      neckDepthFront: 7.5,
      neckDepthBack: 2.5,
      bustCircumference: state.customMeasurements.bust ?? 88,
      waistCircumference: state.customMeasurements.waist ?? 70,
      hipCircumference: state.customMeasurements.hip ?? 92,
      armholeCircumference: state.customMeasurements.armholeCirc ?? 40,
      sleeveLength: state.customMeasurements.sleeveLength ?? 58,
      crocrotchDepth: 26,
      crotchDepth: 26,
      rise: 24,
      thighCircumference: 56,
      additionalEase: 1.5,
      seamAllowanceDefault: 1.5
    };
  });

  const [draftingRules, setDraftingRules] = useState<DraftingRulesConfig>(DEFAULT_DRAFTING_RULES);

  // Active Pieces & Summaries
  const [pieces, setPieces] = useState<CadPiece[]>(() => {
    return generatePatternByNumbers(DEFAULT_PATTERN_NUMBERS, { widthCm: 110, heightCm: 85, unit: 'cm' }).pieces;
  });

  const [summaries, setSummaries] = useState<PieceSpecSummary[]>(() => {
    return generatePatternByNumbers(DEFAULT_PATTERN_NUMBERS, { widthCm: 110, heightCm: 85, unit: 'cm' }).summaries;
  });

  // Synchronize 2D CAD pattern pieces whenever state.customMeasurements or size changes
  useEffect(() => {
    const meas = state.customMeasurements;
    const std = getBaseMeasurements(state.gender, state.size);
    const effectiveBust = meas.bust ?? meas.chest ?? std.bust ?? std.chest ?? 88;
    const effectiveWaist = meas.waist ?? std.waist ?? 70;
    const effectiveHip = meas.hip ?? std.hip ?? 94;
    const effectiveBackLength = meas.backLength ?? std.backLength ?? 40;
    const effectiveShoulder = meas.shoulder ?? std.shoulder ?? 12;
    const effectiveArmhole = meas.armholeCirc ?? std.armholeCirc ?? 42;
    const effectiveSleeve = meas.sleeveLength ?? std.sleeveLength ?? 58;
    const effectiveNeck = meas.neckCirc ?? std.neckCirc ?? 36;

    const updatedInputs: PatternByNumbersInput = {
      ...patternInputs,
      bustCircumference: effectiveBust,
      waistCircumference: effectiveWaist,
      hipCircumference: effectiveHip,
      backLength: effectiveBackLength,
      shoulderLength: effectiveShoulder,
      armholeCircumference: effectiveArmhole,
      sleeveLength: effectiveSleeve,
      neckCircumference: effectiveNeck
    };

    setPatternInputs(updatedInputs);
    const result = generatePatternByNumbers(updatedInputs, workFrame);
    setPieces(result.pieces);
    setSummaries(result.summaries);
  }, [state.gender, state.size, state.customMeasurements]);

  // Active CAD Tool & Modes
  const [activeTool, setActiveTool] = useState<CadActiveTool>('select_move');
  const [seamAllowanceCm, setSeamAllowanceCm] = useState(1.5);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [axisLock, setAxisLock] = useState<'none' | 'x' | 'y'>('none');
  const [curvatureStrength, setCurvatureStrength] = useState(0.5);
  const [mirrorSynced, setMirrorSynced] = useState(true);

  // Selected Elements
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<{
    pieceId: string;
    segId: string;
    pointKey: 'p1' | 'p2' | 'cp1' | 'cp2';
  } | null>(null);
  const [isDraggingNode, setIsDraggingNode] = useState(false);
  const [draggingPiece, setDraggingPiece] = useState<{ pieceId: string; start: CadPoint; original: CadPiece; moved: boolean } | null>(null);
  const [hoveredNode, setHoveredNode] = useState<{
    pieceId: string;
    segId: string;
    pointKey: 'p1' | 'p2' | 'cp1' | 'cp2';
    coords: CadPoint;
  } | null>(null);
  const [alignmentGuide, setAlignmentGuide] = useState<{ x?: number; y?: number } | null>(null);
  const [hoveredSegment, setHoveredSegment] = useState<CadSegment | null>(null);
  const [editLengthVal, setEditLengthVal] = useState<number | ''>('');

  // Guided Draw / Active Drawing State
  const [drawingPoints, setDrawingPoints] = useState<CadPoint[]>([]);
  const [activeCursorPos, setActiveCursorPos] = useState<CadPoint | null>(null);
  const [activeSnapTarget, setActiveSnapTarget] = useState<{ point: CadPoint; type: 'vertex' | 'midpoint' | 'grid' } | null>(null);

  // Free measure tool state
  const [measurePoints, setMeasurePoints] = useState<CadPoint[]>([]);
  const [measureResult, setMeasureResult] = useState<number | null>(null);

  // Modals
  const [showNumbersModal, setShowNumbersModal] = useState(false);
  const [showTilePrintModal, setShowTilePrintModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // History Stack for Undo/Redo
  const [historyStack, setHistoryStack] = useState<HistoryEntry[]>([
    {
      id: 'init',
      timestamp: Date.now(),
      actionNameAr: 'توليد الباترون الأولي بالأرقام',
      pieces: pieces
    }
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Pan & Zoom
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 50, y: 40 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [touchDistance, setTouchDistance] = useState<number | null>(null);

  // Canvas Height & Fullscreen Mode ('compact' | 'medium' | 'large' | 'fullscreen')
  const [canvasHeightMode, setCanvasHeightMode] = useState<'compact' | 'medium' | 'large' | 'fullscreen'>('fullscreen');

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const pxPerCm = 7.5; // Scale factor for rendering

  // Auto-Center & Fit Pattern cleanly in view without covering anything
  const handleCenterAndFitPattern = useCallback(() => {
    if (!containerRef.current) return;
    const containerWidth = containerRef.current.clientWidth || 800;
    const containerHeight = containerRef.current.clientHeight || 600;

    if (containerWidth <= 20 || containerHeight <= 20) return;

    // Calculate bounding box of all active piece segments
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    pieces.forEach(p => {
      p.segments.forEach(s => {
        minX = Math.min(minX, s.p1.x, s.p2.x, s.cp1?.x ?? Infinity, s.cp2?.x ?? Infinity);
        maxX = Math.max(maxX, s.p1.x, s.p2.x, s.cp1?.x ?? -Infinity, s.cp2?.x ?? -Infinity);
        minY = Math.min(minY, s.p1.y, s.p2.y, s.cp1?.y ?? Infinity, s.cp2?.y ?? Infinity);
        maxY = Math.max(maxY, s.p1.y, s.p2.y, s.cp1?.y ?? -Infinity, s.cp2?.y ?? -Infinity);
      });
    });

    if (minX === Infinity || maxX === -Infinity || maxX - minX < 4) {
      minX = 0;
      maxX = workFrame.widthCm;
      minY = 0;
      maxY = workFrame.heightCm;
    }

    const marginCm = 4;
    const patternWidthCm = (maxX - minX) + marginCm * 2;
    const patternHeightCm = (maxY - minY) + marginCm * 2;

    const patternWidthPx = patternWidthCm * pxPerCm;
    const patternHeightPx = patternHeightCm * pxPerCm;

    const pad = 36;
    const usableW = Math.max(100, containerWidth - pad * 2);
    const usableH = Math.max(100, containerHeight - pad * 2);

    const optimalZoom = Math.min(usableW / patternWidthPx, usableH / patternHeightPx, 2.0);
    const clampedZoom = Math.max(0.35, Math.min(2.5, +optimalZoom.toFixed(2)));

    const patternCenterXPx = (minX - marginCm + patternWidthCm / 2) * pxPerCm * clampedZoom;
    const patternCenterYPx = (minY - marginCm + patternHeightCm / 2) * pxPerCm * clampedZoom;

    const targetPanX = Math.round(containerWidth / 2 - patternCenterXPx);
    const targetPanY = Math.round(containerHeight / 2 - patternCenterYPx);

    setZoom(clampedZoom);
    setPan({ x: targetPanX, y: targetPanY });
  }, [pieces, workFrame.widthCm, workFrame.heightCm, pxPerCm]);

  // Trigger auto-centering on initial mount and when dimensions or container mode changes
  useEffect(() => {
    const timer = setTimeout(() => {
      handleCenterAndFitPattern();
    }, 80);
    return () => clearTimeout(timer);
  }, [workFrame.widthCm, workFrame.heightCm, pieces.length, canvasHeightMode, handleCenterAndFitPattern]);

  // Polyline drawing management
  const handleFinishPolyline = useCallback((closeShape: boolean = true) => {
    if (drawingPoints.length < 2) return;
    
    const newSegments: CadSegment[] = [];
    for (let i = 0; i < drawingPoints.length - 1; i++) {
      const p1 = drawingPoints[i];
      const p2 = drawingPoints[i + 1];
      const len = +distance(p1, p2).toFixed(1);
      newSegments.push({
        id: `seg_draw_${Date.now()}_${i}`,
        type: 'line',
        p1,
        p2,
        layer: 'cutting',
        label: `خط: ${len} سم`,
        lengthCm: len
      });
    }

    if (closeShape && drawingPoints.length >= 3) {
      const p1 = drawingPoints[drawingPoints.length - 1];
      const p2 = drawingPoints[0];
      const len = +distance(p1, p2).toFixed(1);
      newSegments.push({
        id: `seg_draw_${Date.now()}_close`,
        type: 'line',
        p1,
        p2,
        layer: 'cutting',
        label: `إغلاق: ${len} سم`,
        lengthCm: len
      });
    }

    const newPiece: CadPiece = {
      id: `piece_custom_${Date.now()}`,
      name: 'Custom Piece',
      nameAr: `قطعة هندسية مخصصة (${pieces.length + 1})`,
      garmentType: 'custom',
      segments: newSegments,
      notches: [],
      grainlines: [],
      seamAllowanceCm: 1.5,
      notes: 'رسم هندسي حر'
    };

    const updated = [...pieces, newPiece];
    setPieces(updated);
    pushHistory('إنهاء رسم قطعة هندسية جديدة', updated);
    setDrawingPoints([]);
    setActiveCursorPos(null);
  }, [drawingPoints, pieces]);

  const handleClearDrawing = useCallback(() => {
    setDrawingPoints([]);
    setActiveCursorPos(null);
  }, []);

  // Split a line or Bezier curve at the closest point without changing its shape.
  const handleSplitSegmentAtPoint = useCallback((pieceId: string, segId: string, splitPt: CadPoint) => {
    const piece = pieces.find(p => p.id === pieceId);
    const original = piece?.segments.find(s => s.id === segId);
    if (!piece || !original) return;

    const pointAt = (t: number): CadPoint => {
      const u = 1 - t;
      if (original.type === 'quad' && original.cp1) {
        return {
          x: u * u * original.p1.x + 2 * u * t * original.cp1.x + t * t * original.p2.x,
          y: u * u * original.p1.y + 2 * u * t * original.cp1.y + t * t * original.p2.y
        };
      }
      if (original.type === 'bezier' && original.cp1 && original.cp2) {
        return {
          x: u ** 3 * original.p1.x + 3 * u * u * t * original.cp1.x + 3 * u * t * t * original.cp2.x + t ** 3 * original.p2.x,
          y: u ** 3 * original.p1.y + 3 * u * u * t * original.cp1.y + 3 * u * t * t * original.cp2.y + t ** 3 * original.p2.y
        };
      }
      return {
        x: original.p1.x + (original.p2.x - original.p1.x) * t,
        y: original.p1.y + (original.p2.y - original.p1.y) * t
      };
    };

    // Project the click onto the actual path; sample curves densely, then refine locally.
    let bestT = 0.5;
    let bestDistance = Infinity;
    const samples = original.type === 'line' ? 1 : 80;
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const d = distance(splitPt, pointAt(t));
      if (d < bestDistance) { bestDistance = d; bestT = t; }
    }
    if (original.type === 'line') {
      const dx = original.p2.x - original.p1.x;
      const dy = original.p2.y - original.p1.y;
      const denom = dx * dx + dy * dy;
      bestT = denom ? Math.max(0, Math.min(1, ((splitPt.x-original.p1.x)*dx + (splitPt.y-original.p1.y)*dy) / denom)) : 0.5;
    } else {
      let lo = Math.max(0, bestT - 1 / samples), hi = Math.min(1, bestT + 1 / samples);
      for (let i = 0; i < 18; i++) {
        const t1 = lo + (hi - lo) / 3, t2 = hi - (hi - lo) / 3;
        if (distance(splitPt, pointAt(t1)) <= distance(splitPt, pointAt(t2))) hi = t2;
        else lo = t1;
      }
      bestT = (lo + hi) / 2;
    }
    if (bestT < 0.015 || bestT > 0.985) return;

    const lerp = (a: CadPoint, b: CadPoint, t: number): CadPoint => ({
      x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t
    });
    let first: CadSegment;
    let second: CadSegment;
    const splitPoint = pointAt(bestT);
    if (original.type === 'quad' && original.cp1) {
      const a = lerp(original.p1, original.cp1, bestT);
      const b = lerp(original.cp1, original.p2, bestT);
      first = { ...original, id: `${segId}_a_${Date.now()}`, p2: splitPoint, cp1: a, lengthCm: +quadLength(original.p1, a, splitPoint).toFixed(2) };
      second = { ...original, id: `${segId}_b_${Date.now()}`, p1: splitPoint, cp1: b, lengthCm: +quadLength(splitPoint, b, original.p2).toFixed(2) };
    } else if (original.type === 'bezier' && original.cp1 && original.cp2) {
      const a = lerp(original.p1, original.cp1, bestT);
      const b = lerp(original.cp1, original.cp2, bestT);
      const c = lerp(original.cp2, original.p2, bestT);
      const d = lerp(a, b, bestT);
      const e = lerp(b, c, bestT);
      first = { ...original, id: `${segId}_a_${Date.now()}`, p2: splitPoint, cp1: a, cp2: d, lengthCm: +bezierLength(original.p1, a, d, splitPoint).toFixed(2) };
      second = { ...original, id: `${segId}_b_${Date.now()}`, p1: splitPoint, cp1: e, cp2: c, lengthCm: +bezierLength(splitPoint, e, c, original.p2).toFixed(2) };
    } else {
      first = { ...original, id: `${segId}_a_${Date.now()}`, p2: splitPoint, lengthCm: +distance(original.p1, splitPoint).toFixed(2) };
      second = { ...original, id: `${segId}_b_${Date.now()}`, p1: splitPoint, lengthCm: +distance(splitPoint, original.p2).toFixed(2) };
    }

    const updated = pieces.map(p => p.id !== pieceId ? p : {
      ...p,
      segments: p.segments.flatMap(s => s.id === segId ? [first, second] : [s])
    });
    setPieces(updated);
    setSelectedPieceId(pieceId);
    setSelectedSegmentId(second.id);
    setSelectedNode(null);
    pushHistory('تقسيم المسار مع الحفاظ على شكله', updated);
  }, [pieces]);

  // Delete a selected endpoint/control handle. Accept explicit target so click handlers never read stale state.
  const handleDeleteNodeAt = useCallback((target: { pieceId: string; segId: string; pointKey: 'p1' | 'p2' | 'cp1' | 'cp2' }) => {
    const { pieceId, segId, pointKey } = target;
    let changed = false;
    const updated = pieces.map(piece => {
      if (piece.id !== pieceId) return piece;
      const segIdx = piece.segments.findIndex(s => s.id === segId);
      if (segIdx < 0) return piece;
      const current = piece.segments[segIdx];

      if (pointKey === 'cp1' || pointKey === 'cp2') {
        if (current.type === 'line') return piece;
        changed = true;
        const segments = piece.segments.map(s => s.id !== segId ? s : ({
          ...s, type: 'line' as const, cp1: undefined, cp2: undefined,
          lengthCm: +distance(s.p1, s.p2).toFixed(2)
        }));
        return { ...piece, segments };
      }

      if (piece.segments.length <= 2) return piece;
      const targetPoint = current[pointKey];
      const otherIdx = piece.segments.findIndex((s, idx) =>
        idx !== segIdx && (distance(s.p1, targetPoint) < 0.01 || distance(s.p2, targetPoint) < 0.01)
      );
      if (otherIdx < 0) return piece;

      const other = piece.segments[otherIdx];
      const otherAtP1 = distance(other.p1, targetPoint) < 0.01;
      const currentAtP1 = distance(current.p1, targetPoint) < 0.01;
      const mergedP1 = otherAtP1 ? other.p2 : other.p1;
      const mergedP2 = currentAtP1 ? current.p2 : current.p1;
      const merged: CadSegment = {
        ...current, id: `seg_merged_${Date.now()}`, p1: mergedP1, p2: mergedP2,
        type: 'line', cp1: undefined, cp2: undefined,
        lengthCm: +distance(mergedP1, mergedP2).toFixed(2),
        label: `مدمج: ${distance(mergedP1, mergedP2).toFixed(1)} سم`
      };
      const segments = piece.segments.filter((_, idx) => idx !== segIdx && idx !== otherIdx);
      segments.splice(Math.min(segIdx, otherIdx), 0, merged);
      changed = true;
      return { ...piece, segments };
    });
    if (!changed) return;
    setPieces(updated);
    setSelectedNode(null);
    pushHistory('حذف نقطة ارتكاز ودمج المسارات', updated);
  }, [pieces]);

  const handleDeleteSelectedNode = useCallback(() => {
    if (selectedNode) handleDeleteNodeAt(selectedNode);
  }, [selectedNode, handleDeleteNodeAt]);

  // Toggle segment curvature (Line <-> Quad curve)
  const handleToggleNodeType = useCallback(() => {
    if (!selectedNode) return;
    const { pieceId, segId } = selectedNode;

    const updated = pieces.map(piece => {
      if (piece.id !== pieceId) return piece;
      const updatedSegs = piece.segments.map(s => {
        if (s.id === segId) {
          if (s.type === 'line') {
            const mid = midPoint(s.p1, s.p2);
            const dx = s.p2.x - s.p1.x;
            const dy = s.p2.y - s.p1.y;
            const len = Math.hypot(dx, dy) || 1;
            const normal = { x: -dy / len, y: dx / len };
            const cp1 = {
              x: +(mid.x + normal.x * 4).toFixed(2),
              y: +(mid.y + normal.y * 4).toFixed(2)
            };
            return {
              ...s,
              type: 'quad' as const,
              cp1,
              lengthCm: +quadLength(s.p1, cp1, s.p2).toFixed(1)
            };
          } else {
            return {
              ...s,
              type: 'line' as const,
              cp1: undefined,
              cp2: undefined,
              lengthCm: +distance(s.p1, s.p2).toFixed(1)
            };
          }
        }
        return s;
      });
      return { ...piece, segments: updatedSegs };
    });

    setPieces(updated);
    pushHistory('تبديل نمط المسار (مستقيم / منحنى)', updated);
  }, [selectedNode, pieces]);

  // Nudge selected node via arrow keys
  const handleNudgeSelectedNode = useCallback((dx: number, dy: number) => {
    if (!selectedNode) return;
    const { pieceId, segId, pointKey } = selectedNode;

    const updated = pieces.map(piece => {
      if (piece.id !== pieceId) return piece;
      const curSeg = piece.segments.find(s => s.id === segId);
      if (!curSeg) return piece;
      const origPt = curSeg[pointKey];
      if (!origPt) return piece;

      const newPt: CadPoint = {
        x: +(origPt.x + dx).toFixed(2),
        y: +(origPt.y + dy).toFixed(2)
      };

      const updatedSegments = piece.segments.map(s => {
        let segCopy = { ...s };
        let modified = false;

        if ((pointKey === 'cp1' || pointKey === 'cp2') && s.id === segId) {
          segCopy[pointKey] = newPt;
          modified = true;
        } else {
          if (distance(s.p1, origPt) < 0.25) {
            segCopy.p1 = newPt;
            modified = true;
          }
          if (distance(s.p2, origPt) < 0.25) {
            segCopy.p2 = newPt;
            modified = true;
          }
        }

        if (modified) {
          if (segCopy.type === 'line') {
            segCopy.lengthCm = +distance(segCopy.p1, segCopy.p2).toFixed(1);
          } else if (segCopy.type === 'quad' && segCopy.cp1) {
            segCopy.lengthCm = +quadLength(segCopy.p1, segCopy.cp1, segCopy.p2).toFixed(1);
          } else if (segCopy.type === 'bezier' && segCopy.cp1 && segCopy.cp2) {
            segCopy.lengthCm = +bezierLength(segCopy.p1, segCopy.cp1, segCopy.cp2, segCopy.p2).toFixed(1);
          }
        }
        return segCopy;
      });

      return { ...piece, segments: updatedSegments };
    });

    setPieces(updated);
  }, [selectedNode, pieces]);

  // Global Keyboard Shortcuts (Escape, Enter, Delete, Arrow Nudging)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'Escape') {
        if (drawingPoints.length > 0) {
          handleClearDrawing();
        } else if (selectedNode) {
          setSelectedNode(null);
        } else if (selectedSegmentId) {
          setSelectedSegmentId(null);
        } else if (canvasHeightMode === 'fullscreen') {
          setCanvasHeightMode('medium');
        }
      } else if (e.key === 'Enter') {
        if (drawingPoints.length >= 2) {
          handleFinishPolyline(true);
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNode) {
          e.preventDefault();
          handleDeleteSelectedNode();
        }
      } else if (selectedNode && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        const step = e.shiftKey ? 1.0 : 0.1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        handleNudgeSelectedNode(dx, dy);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    canvasHeightMode,
    drawingPoints,
    selectedNode,
    selectedSegmentId,
    handleClearDrawing,
    handleFinishPolyline,
    handleDeleteSelectedNode,
    handleNudgeSelectedNode
  ]);

  // Find selected segment object
  const selectedSegment = useMemo(() => {
    if (!selectedSegmentId) return null;
    for (const piece of pieces) {
      const seg = piece.segments.find(s => s.id === selectedSegmentId);
      if (seg) return seg;
    }
    return null;
  }, [selectedSegmentId, pieces]);

  const selectedPiece = useMemo(() => {
    if (!selectedPieceId) return pieces[0] || null;
    return pieces.find(p => p.id === selectedPieceId) || null;
  }, [selectedPieceId, pieces]);

  // Push to history
  const pushHistory = (actionNameAr: string, newPieces: CadPiece[]) => {
    const entry: HistoryEntry = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      actionNameAr,
      pieces: newPieces
    };
    const nextStack = historyStack.slice(0, historyIndex + 1);
    nextStack.push(entry);
    if (nextStack.length > 35) nextStack.shift();
    setHistoryStack(nextStack);
    setHistoryIndex(nextStack.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevIdx = historyIndex - 1;
      setHistoryIndex(prevIdx);
      setPieces(historyStack[prevIdx].pieces);
    }
  };

  const handleRedo = () => {
    if (historyIndex < historyStack.length - 1) {
      const nextIdx = historyIndex + 1;
      setHistoryIndex(nextIdx);
      setPieces(historyStack[nextIdx].pieces);
    }
  };

  // Re-generate from inputs & formulas
  const handleApplyPatternNumbers = useCallback((
    inputs: PatternByNumbersInput,
    rules?: DraftingRulesConfig,
    gType?: 'bodice' | 'shirt' | 'dress' | 'pants' | 'sleeve' | 'skirt'
  ) => {
    setPatternInputs(inputs);
    if (rules) setDraftingRules(rules);
    const targetType = gType || activeGarmentType;
    if (gType) setActiveGarmentType(gType);
    const { pieces: genPieces, summaries: genSummaries } = generatePatternByNumbers(inputs, workFrame, targetType, rules || draftingRules);
    setPieces(genPieces);
    setSummaries(genSummaries);
    pushHistory(`تحديث باترون (${targetType}) بالأرقام`, genPieces);
  }, [workFrame, draftingRules, activeGarmentType]);

  // Update specific segment length directly (Direct Length Override)
  const handleUpdateSegmentLength = (segId: string, targetLengthCm: number) => {
    const updated = pieces.map(piece => {
      const updatedSegments = piece.segments.map(seg => {
        if (seg.id === segId) {
          const currentLen = distance(seg.p1, seg.p2);
          if (currentLen === 0) return seg;
          const ratio = targetLengthCm / currentLen;
          const newP2: CadPoint = {
            x: +(seg.p1.x + (seg.p2.x - seg.p1.x) * ratio).toFixed(2),
            y: +(seg.p1.y + (seg.p2.y - seg.p1.y) * ratio).toFixed(2)
          };
          return {
            ...seg,
            p2: newP2,
            lengthCm: targetLengthCm,
            label: seg.label ? seg.label.replace(/\d+(\.\d+)?/, `${targetLengthCm}`) : `${targetLengthCm} سم`
          };
        }
        return seg;
      });
      return { ...piece, segments: updatedSegments };
    });
    setPieces(updated);
    pushHistory(`تعديل طول المسار إلى ${targetLengthCm} سم`, updated);
  };

  // Update specific edge seam allowance
  const handleUpdateEdgeSeam = (edgeType: string, allowanceCm: number) => {
    const updated = pieces.map(piece => {
      const edgeSeams = { ...(piece.edgeSeamAllowances || {}), [edgeType]: allowanceCm };
      return {
        ...piece,
        edgeSeamAllowances: edgeSeams
      };
    });
    setPieces(updated);
    pushHistory(`تحديث بدل خياطة ${edgeType} إلى ${allowanceCm} سم`, updated);
  };

  // Seam Allowance Global Applicator
  const handleApplySeamAllowance = () => {
    const updated = pieces.map(piece => {
      const updatedSegments = piece.segments.map(seg => {
        if (seg.layer === 'stitch') {
          return {
            ...seg,
            label: `خط الخياطة (بدل ${seamAllowanceCm} سم)`
          };
        }
        return seg;
      });
      return {
        ...piece,
        seamAllowanceCm: seamAllowanceCm,
        segments: updatedSegments
      };
    });
    setPieces(updated);
    pushHistory(`تطبيق سماحة خياطة عامة ${seamAllowanceCm} سم`, updated);
  };

  // Mirror Piece along horizontal/vertical center
  const handleMirrorPiece = (pieceId?: string) => {
    const targetId = pieceId || selectedPieceId || (pieces.length > 0 ? pieces[0].id : null);
    if (!targetId) return;
    const updated = pieces.map(piece => {
      if (piece.id === targetId) {
        let minX = Infinity, maxX = -Infinity;
        piece.segments.forEach(s => {
          minX = Math.min(minX, s.p1.x, s.p2.x);
          maxX = Math.max(maxX, s.p1.x, s.p2.x);
        });
        const midX = (minX + maxX) / 2;
        const mirroredSegments = piece.segments.map(s => ({
          ...s,
          id: `${s.id}_mir_${Date.now()}`,
          p1: { x: +(2 * midX - s.p1.x).toFixed(2), y: s.p1.y },
          p2: { x: +(2 * midX - s.p2.x).toFixed(2), y: s.p2.y },
          cp1: s.cp1 ? { x: +(2 * midX - s.cp1.x).toFixed(2), y: s.cp1.y } : undefined,
          cp2: s.cp2 ? { x: +(2 * midX - s.cp2.x).toFixed(2), y: s.cp2.y } : undefined
        }));
        return {
          ...piece,
          segments: mirroredSegments
        };
      }
      return piece;
    });
    setPieces(updated);
    pushHistory('عكس القطعة بالمرآة (Mirror)', updated);
  };

  // Smooth / Simplify Curves
  const handleSmoothSimplify = (pieceId?: string) => {
    const targetId = pieceId || selectedPieceId || (pieces.length > 0 ? pieces[0].id : null);
    if (!targetId) return;
    const updated = pieces.map(piece => {
      if (piece.id === targetId) {
        const smoothedSegments = piece.segments.map(s => {
          if (s.type === 'line') {
            const mid = midPoint(s.p1, s.p2);
            const cp1 = {
              x: +(mid.x + (s.p2.y - s.p1.y) * 0.15).toFixed(2),
              y: +(mid.y - (s.p2.x - s.p1.x) * 0.15).toFixed(2)
            };
            return {
              ...s,
              type: 'quad' as const,
              cp1
            };
          }
          return s;
        });
        return { ...piece, segments: smoothedSegments };
      }
      return piece;
    });
    setPieces(updated);
    pushHistory('تنعيم المنحنيات (Smooth Curves)', updated);
  };

  // Template loader
  const handleLoadTemplate = (tplId: 'bodice' | 'shirt' | 'dress' | 'pants' | 'sleeve' | 'skirt') => {
    setActiveGarmentType(tplId);
    let newInputs: PatternByNumbersInput = { ...patternInputs };
    if (tplId === 'dress') {
      newInputs.backLength = 105;
      newInputs.frontLength = 105;
      newInputs.additionalEase = 2.0;
    } else if (tplId === 'pants') {
      newInputs.backLength = 100;
      newInputs.hipCircumference = 98;
      newInputs.waistCircumference = 76;
      newInputs.crotchDepth = 26;
      newInputs.thighCircumference = 58;
    } else if (tplId === 'shirt') {
      newInputs.backLength = 72;
      newInputs.frontLength = 72;
      newInputs.additionalEase = 3.0;
      newInputs.neckCircumference = 39;
    } else if (tplId === 'skirt') {
      newInputs.backLength = 65;
      newInputs.frontLength = 65;
      newInputs.hipCircumference = 98;
      newInputs.waistCircumference = 74;
    } else if (tplId === 'bodice') {
      newInputs.backLength = 41;
      newInputs.frontLength = 43;
      newInputs.additionalEase = 1.5;
    }
    handleApplyPatternNumbers(newInputs, undefined, tplId);

    // Keep the 3D mannequin dressed with the garment that is being drafted.
    const garmentByTemplate: Record<string, GarmentType> = {
      bodice: 'blouse',
      shirt: 'shirt',
      dress: 'dress',
      pants: 'pants',
      skirt: 'skirt'
    };
    const nextGarment = garmentByTemplate[tplId];
    if (nextGarment) onGarmentChange?.(nextGarment);
  };

  // Smart Snapping Locator (find nearest vertex, midpoint, or major grid within 1.2cm threshold)
  const getSnapTarget = (rawPt: CadPoint): { point: CadPoint; type: 'vertex' | 'midpoint' | 'grid' } | null => {
    if (!snapEnabled) return null;
    const snapDistThreshold = 1.2; // in cm

    let closest: { point: CadPoint; type: 'vertex' | 'midpoint' | 'grid'; dist: number } | null = null;

    // 1. Check vertices & midpoints of all pieces
    for (const piece of pieces) {
      for (const seg of piece.segments) {
        // Vertex P1
        const d1 = distance(rawPt, seg.p1);
        if (d1 < snapDistThreshold && (!closest || d1 < closest.dist)) {
          closest = { point: seg.p1, type: 'vertex', dist: d1 };
        }
        // Vertex P2
        const d2 = distance(rawPt, seg.p2);
        if (d2 < snapDistThreshold && (!closest || d2 < closest.dist)) {
          closest = { point: seg.p2, type: 'vertex', dist: d2 };
        }
        // Midpoint
        const mid = midPoint(seg.p1, seg.p2);
        const dMid = distance(rawPt, mid);
        if (dMid < snapDistThreshold && (!closest || dMid < closest.dist)) {
          closest = { point: mid, type: 'midpoint', dist: dMid };
        }
      }
    }

    // 2. Grid snap fallback (snap to nearest 1cm if close)
    if (!closest) {
      const snapX = Math.round(rawPt.x);
      const snapY = Math.round(rawPt.y);
      const gridPt = { x: snapX, y: snapY };
      const dGrid = distance(rawPt, gridPt);
      if (dGrid < 0.6) {
        return { point: gridPt, type: 'grid' };
      }
    }

    return closest ? { point: closest.point, type: closest.type } : null;
  };

  // Convert client cursor to CAD coordinates with axis lock & snapping
  const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent, referenceStartPt?: CadPoint | null, applySnap: boolean = true): CadPoint | null => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    let svgX = (clientX - rect.left - pan.x) / (zoom * pxPerCm);
    let svgY = (clientY - rect.top - pan.y) / (zoom * pxPerCm);

    // Apply Axis Lock if active
    if (referenceStartPt) {
      if (axisLock === 'x') {
        svgY = referenceStartPt.y;
      } else if (axisLock === 'y') {
        svgX = referenceStartPt.x;
      }
    }

    const rawPt = { x: +svgX.toFixed(2), y: +svgY.toFixed(2) };

    // Apply smart snapping
    const snap = applySnap ? getSnapTarget(rawPt) : null;
    if (snap) {
      setActiveSnapTarget(snap);
      return snap.point;
    } else {
      setActiveSnapTarget(null);
      return rawPt;
    }
  };

  // Canvas Mouse & Touch Handlers
  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if ('touches' in e && e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setTouchDistance(dist);
      return;
    }

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    if (activeTool === 'pan' || ('button' in e && e.button === 1) || e.altKey) {
      setIsPanning(true);
      setPanStart({ x: clientX - pan.x, y: clientY - pan.y });
      return;
    }

    const pt = getCanvasCoords(e);
    if (!pt) return;

    // MEASURE TOOL
    if (activeTool === 'measure_tool') {
      if (measurePoints.length === 0) {
        setMeasurePoints([pt]);
        setMeasureResult(null);
      } else {
        const p1 = measurePoints[0];
        const dist = +distance(p1, pt).toFixed(1);
        setMeasurePoints([p1, pt]);
        setMeasureResult(dist);
      }
      return;
    }

    // DRAW LINE / MULTI-POINT POLYLINE
    if (activeTool === 'draw_line') {
      if (drawingPoints.length === 0) {
        setDrawingPoints([pt]);
      } else {
        // If clicking close to the starting point, close the shape into a polygon piece
        if (drawingPoints.length >= 2 && distance(pt, drawingPoints[0]) < 1.5) {
          handleFinishPolyline(true);
          return;
        }
        setDrawingPoints([...drawingPoints, pt]);
      }
      return;
    }

    // DRAW QUAD CURVE
    if (activeTool === 'draw_quad') {
      if (drawingPoints.length === 0) {
        setDrawingPoints([pt]);
      } else if (drawingPoints.length === 1) {
        setDrawingPoints([drawingPoints[0], pt]);
      } else {
        const p1 = drawingPoints[0];
        const p2 = drawingPoints[1];
        const cp1 = pt;
        const len = +quadLength(p1, cp1, p2).toFixed(1);
        const newSeg: CadSegment = {
          id: `seg_quad_${Date.now()}`,
          type: 'quad',
          p1,
          p2,
          cp1,
          layer: 'cutting',
          label: `منحنى: ${len} سم`,
          lengthCm: len
        };
        const newPiece: CadPiece = {
          id: `piece_custom_quad_${Date.now()}`,
          name: 'Custom Curve', nameAr: 'منحنى مخصص',
          garmentType: 'custom', segments: [newSeg], notches: [], grainlines: [],
          seamAllowanceCm: 1.5, notes: 'رسم منحنى قياسي'
        };
        const updated = [...pieces, newPiece];
        setPieces(updated);
        setSelectedPieceId(newPiece.id);
        setSelectedSegmentId(newSeg.id);
        pushHistory('رسم منحنى قياسي (QuadCurve)', updated);
        setDrawingPoints([]);
      }
      return;
    }

    // DRAW BEZIER
    if (activeTool === 'draw_bezier') {
      if (drawingPoints.length < 3) {
        setDrawingPoints([...drawingPoints, pt]);
      } else {
        const p1 = drawingPoints[0];
        const p2 = drawingPoints[1];
        const cp1 = drawingPoints[2];
        const cp2 = pt;
        const len = +bezierLength(p1, cp1, cp2, p2).toFixed(1);
        const newSeg: CadSegment = {
          id: `seg_bezier_${Date.now()}`,
          type: 'bezier',
          p1,
          p2,
          cp1,
          cp2,
          layer: 'cutting',
          label: `منحنى بيزيه: ${len} سم`,
          lengthCm: len
        };
        const newPiece: CadPiece = {
          id: `piece_custom_bezier_${Date.now()}`,
          name: 'Custom Bezier', nameAr: 'منحنى بيزيه مخصص',
          garmentType: 'custom', segments: [newSeg], notches: [], grainlines: [],
          seamAllowanceCm: 1.5, notes: 'رسم منحنى بيزيه'
        };
        const updated = [...pieces, newPiece];
        setPieces(updated);
        setSelectedPieceId(newPiece.id);
        setSelectedSegmentId(newSeg.id);
        pushHistory('رسم منحنى بيزيه احترافي (Bezier)', updated);
        setDrawingPoints([]);
      }
      return;
    }

    // ADD ANCHOR / SPLIT TRIM
    if (activeTool === 'add_anchor' || activeTool === 'split_trim') {
      // Find nearest segment to split
      for (const piece of pieces) {
        for (const seg of piece.segments) {
          const mid = midPoint(seg.p1, seg.p2);
          if (distance(pt, mid) < 3.5 || distance(pt, seg.p1) < 2.0 || distance(pt, seg.p2) < 2.0) {
            handleSplitSegmentAtPoint(piece.id, seg.id, pt);
            return;
          }
        }
      }
    }

    // REMOVE ANCHOR
    if (activeTool === 'remove_anchor') {
      if (selectedNode) {
        handleDeleteSelectedNode();
        return;
      }
      // Or find nearest vertex
      for (const piece of pieces) {
        for (const seg of piece.segments) {
          if (distance(pt, seg.p1) < 2.0) {
            handleDeleteNodeAt({ pieceId: piece.id, segId: seg.id, pointKey: 'p1' });
            return;
          }
          if (distance(pt, seg.p2) < 2.0) {
            handleDeleteNodeAt({ pieceId: piece.id, segId: seg.id, pointKey: 'p2' });
            return;
          }
        }
      }
    }

    // SMOOTH / SIMPLIFY
    if (activeTool === 'smooth_simplify') {
      handleSmoothSimplify();
      return;
    }

    // MIRROR / DUPLICATE
    if (activeTool === 'mirror_dup') {
      handleMirrorPiece();
      return;
    }

    // ADD NOTCH
    if (activeTool === 'add_notch') {
      if (pieces.length > 0) {
        const newNotch: CadNotch = {
          id: `notch_${Date.now()}`,
          point: pt,
          angleDeg: 45,
          type: 'v_notch',
          depthCm: 0.6,
          label: 'نوتش مخصص'
        };
        const targetId = selectedPieceId || pieces[0].id;
        const updated = pieces.map(piece => piece.id === targetId ? { ...piece, notches: [...piece.notches, newNotch] } : piece);
        setPieces(updated);
        pushHistory('إضافة علامة نوتش', updated);
      }
      return;
    }

    // ADD GRAINLINE
    if (activeTool === 'add_grainline') {
      if (pieces.length > 0) {
        const newGrain: CadGrainline = {
          id: `grain_${Date.now()}`,
          p1: pt,
          p2: { x: pt.x, y: pt.y + 30 },
          label: 'اتجاه النسيج'
        };
        const targetId = selectedPieceId || pieces[0].id;
        const updated = pieces.map(piece => piece.id === targetId ? { ...piece, grainlines: [...piece.grainlines, newGrain] } : piece);
        setPieces(updated);
        pushHistory('إضافة خط اتجاه النسيج', updated);
      }
      return;
    }

    // Default drag / pan
    setIsPanning(true);
    setPanStart({ x: clientX - pan.x, y: clientY - pan.y });
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if ('touches' in e && e.touches.length === 2 && touchDistance !== null) {
      const newDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const zoomFactor = newDist / touchDistance;
      setZoom(z => Math.max(0.3, Math.min(3.5, z * zoomFactor)));
      setTouchDistance(newDist);
      return;
    }

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const refPt = drawingPoints.length > 0 ? drawingPoints[0] : null;
    const pt = getCanvasCoords(e, refPt, !isDraggingNode && !draggingPiece);
    if (pt) setActiveCursorPos(pt);

    if (draggingPiece && pt) {
      const dx = pt.x - draggingPiece.start.x;
      const dy = pt.y - draggingPiece.start.y;
      const movePoint = (point?: CadPoint): CadPoint | undefined => point ? ({
        ...point, x: +(point.x + dx).toFixed(2), y: +(point.y + dy).toFixed(2)
      }) : undefined;
      const original = draggingPiece.original;
      const moved: CadPiece = {
        ...original,
        segments: original.segments.map(seg => ({
          ...seg,
          p1: movePoint(seg.p1)!,
          p2: movePoint(seg.p2)!,
          cp1: movePoint(seg.cp1),
          cp2: movePoint(seg.cp2),
          badgePos: movePoint(seg.badgePos)
        })),
        notches: original.notches.map(notch => ({ ...notch, point: movePoint(notch.point)! })),
        grainlines: original.grainlines.map(line => ({ ...line, p1: movePoint(line.p1)!, p2: movePoint(line.p2)! }))
      };
      setPieces(current => current.map(piece => piece.id === draggingPiece.pieceId ? moved : piece));
      if (!draggingPiece.moved && (Math.abs(dx) > 0.02 || Math.abs(dy) > 0.02)) setDraggingPiece(current => current ? { ...current, moved: true } : null);
      return;
    }

    if (selectedNode && isDraggingNode) {
      if (pt) {
        let finalPt = { ...pt };
        let foundGuide: { x?: number; y?: number } | null = null;

        // Check axis alignment with other piece nodes
        for (const piece of pieces) {
          for (const s of piece.segments) {
            for (const otherPt of [s.p1, s.p2]) {
              if (Math.abs(otherPt.x - finalPt.x) < 0.35) {
                finalPt.x = otherPt.x;
                foundGuide = { ...(foundGuide || {}), x: otherPt.x };
              }
              if (Math.abs(otherPt.y - finalPt.y) < 0.35) {
                finalPt.y = otherPt.y;
                foundGuide = { ...(foundGuide || {}), y: otherPt.y };
              }
            }
          }
        }
        setAlignmentGuide(foundGuide);

        const updated = pieces.map(piece => {
          if (piece.id !== selectedNode.pieceId) return piece;

          const targetSeg = piece.segments.find(s => s.id === selectedNode.segId);
          if (!targetSeg) return piece;
          const origPt = targetSeg[selectedNode.pointKey];
          if (!origPt) return piece;

          const updatedSegments = piece.segments.map(seg => {
            let s = { ...seg };
            let modified = false;

            if ((selectedNode.pointKey === 'cp1' || selectedNode.pointKey === 'cp2') && seg.id === selectedNode.segId) {
              s[selectedNode.pointKey] = finalPt;
              modified = true;
            } else {
              if (distance(s.p1, origPt) < 0.3) {
                s.p1 = finalPt;
                modified = true;
              }
              if (distance(s.p2, origPt) < 0.3) {
                s.p2 = finalPt;
                modified = true;
              }
            }

            if (modified) {
              if (s.type === 'line') {
                s.lengthCm = +distance(s.p1, s.p2).toFixed(1);
              } else if (s.type === 'quad' && s.cp1) {
                s.lengthCm = +quadLength(s.p1, s.cp1, s.p2).toFixed(1);
              } else if (s.type === 'bezier' && s.cp1 && s.cp2) {
                s.lengthCm = +bezierLength(s.p1, s.cp1, s.cp2, s.p2).toFixed(1);
              }
            }
            return s;
          });

          return { ...piece, segments: updatedSegments };
        });

        setPieces(updated);
      }
      return;
    }

    if (isPanning) {
      setPan({ x: clientX - panStart.x, y: clientY - panStart.y });
    }
  };

  const handlePointerUp = () => {
    if (isDraggingNode) {
      setIsDraggingNode(false);
      setAlignmentGuide(null);
      pushHistory('تحريك نقطة ارتكاز', pieces);
    }
    if (draggingPiece) {
      setDraggingPiece(null);
      if (draggingPiece.moved) pushHistory('تحريك قطعة كاملة', pieces);
    }
    setIsPanning(false);
    setTouchDistance(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const factor = e.deltaY < 0 ? 1.12 : 0.88;
    const nextZoom = Math.max(0.3, Math.min(3.5, zoom * factor));
    const ratio = nextZoom / zoom;
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;
    setPan(current => ({
      x: cursorX - (cursorX - current.x) * ratio,
      y: cursorY - (cursorY - current.y) * ratio
    }));
    setZoom(nextZoom);
  };

  const handleDoubleTap = () => {
    setSelectedSegmentId(null);
    setSelectedNode(null);
    setMeasurePoints([]);
    setMeasureResult(null);
    setDrawingPoints([]);
  };

  // Copy Summary List as Plain Text
  const handleCopySummaryText = () => {
    const text = summaries.map((s, i) =>
      `${i + 1}. ${s.nameAr} (${s.nameEn}) - الطول: ${fmt(s.lengthCm)} | العرض: ${fmt(s.widthCm)} | سماحة الخياطة: ${fmt(s.seamAllowanceCm)} | عدد النوتشات: ${s.notchesCount}\nملاحظات: ${s.notesAr}`
    ).join('\n\n');

    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2500);
    });
  };

  // Download SVG file
  const handleDownloadSVG = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    const link = document.createElement('a');
    link.href = svgUrl;
    link.download = `cad-pattern-${state.garment}-${workFrame.widthCm}x${workFrame.heightCm}cm.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Generate ruler tick marks
  const topRulerTicks = useMemo(() => {
    const ticks = [];
    for (let x = 0; x <= workFrame.widthCm; x += 5) {
      ticks.push(x);
    }
    return ticks;
  }, [workFrame.widthCm]);

  const leftRulerTicks = useMemo(() => {
    const ticks = [];
    for (let y = 0; y <= workFrame.heightCm; y += 5) {
      ticks.push(y);
    }
    return ticks;
  }, [workFrame.heightCm]);

  // Primary Drawing Tool list for the fixed perimeter bar
  const perimeterTools: { id: CadActiveTool; label: string; icon: React.ReactNode; tooltip: string }[] = [
    { id: 'select_move', label: 'تحديد', icon: <MousePointer className="w-5 h-5" />, tooltip: 'تحديد وتحريك النقاط والقطع' },
    { id: 'draw_line', label: 'خط', icon: <PenTool className="w-5 h-5" />, tooltip: 'رسم مسار خطي دقيق بين عدة نقاط' },
    { id: 'draw_quad', label: 'منحنى', icon: <Wand2 className="w-5 h-5 text-amber-400" />, tooltip: 'رسم منحنى تقويسي قياسي بنقطة تحكم' },
    { id: 'draw_bezier', label: 'بيزيه', icon: <Sparkles className="w-5 h-5 text-purple-400" />, tooltip: 'رسم منحنى بيزيه احترافي بمقابض تحكم' },
    { id: 'add_anchor', label: '+ نقطة', icon: <Plus className="w-5 h-5 text-emerald-400" />, tooltip: 'إضافة نقطة ارتكاز جديدة على المسار' },
    { id: 'remove_anchor', label: '- نقطة', icon: <Minus className="w-5 h-5 text-rose-400" />, tooltip: 'حذف نقطة ارتكاز وإعادة وصل المسار' },
    { id: 'split_trim', label: 'تقسيم', icon: <Split className="w-5 h-5 text-indigo-400" />, tooltip: 'قص وتقسيم المسارات عند نقطة محددة' },
    { id: 'smooth_simplify', label: 'تنعيم', icon: <Wand2 className="w-5 h-5 text-cyan-400" />, tooltip: 'تنعيم المنحنيات وإلغاء التعرجات' },
    { id: 'mirror_dup', label: 'مرآة', icon: <Copy className="w-5 h-5 text-fuchsia-400" />, tooltip: 'عكس المسار بالمرآة أو مضاعفته' },
    { id: 'add_notch', label: 'نوتش', icon: <Scissors className="w-5 h-5 text-rose-400" />, tooltip: 'إضافة علامة نوتش للتركيب والتطابق' },
    { id: 'add_grainline', label: 'نسيج', icon: <Compass className="w-5 h-5 text-cyan-400" />, tooltip: 'إضافة سهم اتجاه النسيج الطولي' },
    { id: 'measure_tool', label: 'قياس', icon: <Ruler className="w-5 h-5 text-emerald-400" />, tooltip: 'أداة قياس المسافات الحرة بين نقطتين' },
    { id: 'seam_allowance', label: 'سماحة', icon: <Sliders className="w-5 h-5 text-blue-400" />, tooltip: 'تعديل وتطبيق سماحات الخياطة' }
  ];

  return (
    <div
      className="w-full h-full flex flex-col font-['Cairo',sans-serif] select-none relative bg-slate-950 overflow-hidden text-slate-100"
      dir="rtl"
    >
      

      {/* 2. MAIN CAD WORKSPACE (لوحة العمل المركزية مع أشرطة الأدوات الثابتة على الأطراف) */}
      <div
        className="flex flex-row w-full flex-1 h-full min-h-0 relative overflow-hidden"
      >
        
        {/* FIXED PERIMETER TOOLBAR (شريط الأدوات الجانبي الثابت على الطرف - رموز ثابتة) */}
        <div className="w-11 sm:w-12 bg-slate-900/95 border-l border-slate-800 flex flex-col items-center py-1.5 px-0.5 gap-1 z-10 shrink-0 overflow-y-auto">
          {perimeterTools.map(tool => {
            const isActive = activeTool === tool.id;
            return (
              <button
                key={tool.id}
                onClick={() => setActiveTool(tool.id)}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-95 group relative ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 ring-2 ring-blue-400'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
                }`}
                title={tool.tooltip}
              >
                {tool.icon}

                
                {/* Hover Tooltip label */}
                <div className="absolute right-full mr-2 px-2 py-1 bg-slate-800 text-white text-[11px] font-bold rounded-lg whitespace-nowrap shadow-xl border border-slate-700 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-30">
                  {tool.tooltip}
                </div>
              </button>
            );
          })}

          <div className="w-8 h-[1px] bg-slate-800 my-1 shrink-0" />

          {/* Smart Snap Toggle */}
          <button
            onClick={() => setSnapEnabled(!snapEnabled)}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-95 ${
              snapEnabled
                ? 'bg-emerald-600/30 border border-emerald-500/50 text-emerald-300'
                : 'text-slate-500 hover:bg-slate-800'
            }`}
            title={snapEnabled ? 'الجذب الذكي مفعّل (Smart Snap ON)' : 'الجذب الذكي معطّل (Smart Snap OFF)'}
          >
            <Magnet className="w-5 h-5" />
          </button>

          {/* Axis Lock */}
          <button
            onClick={() => setAxisLock(l => l === 'none' ? 'x' : l === 'x' ? 'y' : 'none')}
            className={`w-11 sm:w-12 h-11 sm:h-12 rounded-2xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-all active:scale-95 ${
              axisLock !== 'none'
                ? 'bg-purple-600/30 border border-purple-500/50 text-purple-300'
                : 'text-slate-500 hover:bg-slate-800'
            }`}
            title={`قفل المحور: ${axisLock === 'none' ? 'حر' : (axisLock === 'x' ? 'أفقي X' : 'عمودي Y')}`}
          >
            {axisLock === 'none' ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5 text-purple-400" />}
            <span className="scale-85">{axisLock === 'none' ? 'حر' : axisLock.toUpperCase()}</span>
          </button>

          {/* History Modal Trigger */}
          <button
            onClick={() => setShowHistoryModal(true)}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-all active:scale-95"
            title="سجل التعديلات والخطوات"
          >
            <RotateCw className="w-5 h-5" />
          </button>
        </div>

        {/* CENTER UNOBSTRUCTED CANVAS (مساحة عرض الباترون الصافية والنظيفة تماماً) */}
        <div
          ref={containerRef}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onWheel={handleWheel}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
          onTouchCancel={handlePointerUp}
          onDoubleClick={handleDoubleTap}
          className="flex-1 h-full bg-slate-950 overflow-hidden cursor-crosshair relative touch-none"
        >
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            className="w-full h-full"
          >
            <defs>
              {/* Fine Grid Pattern */}
              <pattern id="cadGridFine" width={pxPerCm} height={pxPerCm} patternUnits="userSpaceOnUse">
                <rect width={pxPerCm} height={pxPerCm} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
              </pattern>
              {/* Major 10cm Grid Pattern */}
              <pattern id="cadGridMajor" width={pxPerCm * 10} height={pxPerCm * 10} patternUnits="userSpaceOnUse">
                <rect width={pxPerCm * 10} height={pxPerCm * 10} fill="url(#cadGridFine)" stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
              </pattern>

              {/* Arrowhead Markers */}
              <marker id="cadArrowGrain" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 2 L 6 5 L 0 8 z" fill="#38bdf8" />
              </marker>
              <marker id="cadArrowDim" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
                <path d="M 0 1.5 L 6 5 L 0 8.5 z" fill="#c084fc" />
              </marker>
            </defs>

            {/* Pan & Zoom Container */}
            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
              
              {/* Optional Background Grid */}
              {layers.grid && (
                <rect x="-1000" y="-1000" width="4000" height="4000" fill="url(#cadGridMajor)" />
              )}

              {/* Work Frame (إطار ورقة العمل) */}
              <g id="work-frame-group">
                <rect
                  x="0"
                  y="0"
                  width={workFrame.widthCm * pxPerCm}
                  height={workFrame.heightCm * pxPerCm}
                  fill="rgba(15, 23, 42, 0.92)"
                  stroke="#3b82f6"
                  strokeWidth="2"
                  strokeDasharray="6 3"
                  rx="8"
                />

                {/* Ruler Ticks (Top & Left) */}
                {layers.rulers && (
                  <g className="opacity-80 pointer-events-none">
                    {/* Top Ruler Ticks */}
                    {topRulerTicks.map(x => (
                      <g key={`ruler-top-${x}`} transform={`translate(${x * pxPerCm}, 0)`}>
                        <line x1="0" y1="0" x2="0" y2="8" stroke="#60a5fa" strokeWidth="1" />
                        <text x="2" y="14" fill="#93c5fd" fontSize="8" fontFamily="Tajawal" fontWeight="bold">
                          {x}
                        </text>
                      </g>
                    ))}
                    {/* Left Ruler Ticks */}
                    {leftRulerTicks.map(y => (
                      <g key={`ruler-left-${y}`} transform={`translate(0, ${y * pxPerCm})`}>
                        <line x1="0" y1="0" x2="8" y2="0" stroke="#60a5fa" strokeWidth="1" />
                        <text x="10" y="4" fill="#93c5fd" fontSize="8" fontFamily="Tajawal" fontWeight="bold">
                          {y}
                        </text>
                      </g>
                    ))}
                  </g>
                )}

                {/* Work Frame Dimensions Label Tag */}
                <g transform={`translate(10, ${workFrame.heightCm * pxPerCm - 15})`} className="pointer-events-none">
                  <rect width="180" height="24" rx="6" fill="#1e293b" stroke="#475569" strokeWidth="1" />
                  <text x="90" y="16" fill="#94a3b8" textAnchor="middle" fontSize="11" fontFamily="Tajawal" fontWeight="bold">
                    إطار العمل: {workFrame.widthCm} × {workFrame.heightCm} سم
                  </text>
                </g>

                {/* Corner Calibrations */}
                <circle cx="0" cy="0" r="4" fill="#3b82f6" />
                <circle cx={workFrame.widthCm * pxPerCm} cy="0" r="4" fill="#3b82f6" />
                <circle cx="0" cy={workFrame.heightCm * pxPerCm} r="4" fill="#3b82f6" />
                <circle cx={workFrame.widthCm * pxPerCm} cy={workFrame.heightCm * pxPerCm} r="4" fill="#3b82f6" />
              </g>

              {/* Render CAD Pieces & Paths */}
              {pieces.map(piece => {
                const isSelectedPiece = selectedPieceId === piece.id;
                const closedPath = pieceToClosedSvgPath(piece, pxPerCm);

                return (
                  <g key={piece.id} id={`cad-piece-${piece.id}`}>
                    
                    {/* 0. Closed Silhouette Fill (خلفية ومساحة القطعة المكتملة) */}
                    {closedPath && (
                      <path
                        d={closedPath}
                        fill={isSelectedPiece ? `${piece.color || '#3b82f6'}26` : `${piece.color || '#3b82f6'}0d`}
                        stroke={isSelectedPiece ? `${piece.color || '#3b82f6'}50` : 'transparent'}
                        strokeWidth="1.5"
                        strokeDasharray={isSelectedPiece ? '4 4' : undefined}
                        className="transition-colors cursor-pointer hover:opacity-90"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPieceId(piece.id);
                        }}
                      />
                    )}

                    {/* 1. Path Segments */}
                    {piece.segments.map(seg => {
                      const isVisible = (seg.layer === 'cutting' && layers.cutting) ||
                                        (seg.layer === 'stitch' && layers.stitch) ||
                                        (seg.layer === 'seam' && layers.seam);
                      if (!isVisible) return null;

                      const isHovered = hoveredSegment?.id === seg.id;
                      const isSelected = selectedSegmentId === seg.id;

                      const pathData = segmentToSvgPath(seg, pxPerCm);
                      const mid = midPoint(seg.p1, seg.p2);
                      const badgeX = (seg.badgePos?.x ?? mid.x) * pxPerCm;
                      const badgeY = (seg.badgePos?.y ?? mid.y) * pxPerCm;

                      const strokeColor = seg.layer === 'cutting'
                        ? (isHovered || isSelected ? '#38bdf8' : (piece.color || '#3b82f6'))
                        : seg.layer === 'stitch'
                        ? '#10b981'
                        : '#f59e0b';

                      const strokeDash = seg.layer === 'stitch' ? '5 4' : undefined;
                      const strokeWidth = seg.layer === 'cutting' ? (isHovered || isSelected ? 3.5 : 2.5) : 1.5;

                      return (
                        <g
                          key={seg.id}
                          onMouseDown={(e) => {
                            if (activeTool !== 'select_move' || e.button !== 0) return;
                            e.stopPropagation();
                            const start = getCanvasCoords(e);
                            if (!start) return;
                            setSelectedPieceId(piece.id);
                            setSelectedSegmentId(seg.id);
                            setDraggingPiece({ pieceId: piece.id, start, original: piece, moved: false });
                          }}
                          onTouchStart={(e) => {
                            if (activeTool !== 'select_move') return;
                            e.stopPropagation();
                            const start = getCanvasCoords(e);
                            if (!start) return;
                            setSelectedPieceId(piece.id);
                            setSelectedSegmentId(seg.id);
                            setDraggingPiece({ pieceId: piece.id, start, original: piece, moved: false });
                          }}
                          onMouseEnter={() => setHoveredSegment(seg)}
                          onMouseLeave={() => setHoveredSegment(null)}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (draggingPiece) return;
                            setSelectedSegmentId(seg.id);
                            setSelectedPieceId(piece.id);
                            setEditLengthVal(seg.lengthCm || '');
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            const pt = getCanvasCoords(e);
                            if (pt) handleSplitSegmentAtPoint(piece.id, seg.id, pt);
                          }}
                        >
                          {/* Wide Click Target */}
                          <path
                            d={pathData}
                            fill="none"
                            stroke="transparent"
                            strokeWidth="20"
                            className="cursor-pointer"
                          />

                          {/* Visible Path */}
                          <path
                            d={pathData}
                            fill="none"
                            stroke={strokeColor}
                            strokeWidth={strokeWidth}
                            strokeDasharray={strokeDash}
                          />

                          {/* Draggable Numeric Measurement Tag */}
                          {layers.dimensions && (isHovered || isSelected || seg.layer === 'cutting') && (
                            <g
                              transform={`translate(${badgeX}, ${badgeY})`}
                              className="cursor-pointer pointer-events-auto"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSegmentId(seg.id);
                                setSelectedPieceId(piece.id);
                                setEditLengthVal(seg.lengthCm || '');
                              }}
                            >
                              <rect
                                x="-36"
                                y="-11"
                                width="72"
                                height="22"
                                rx="6"
                                fill={isSelected ? "#2563eb" : (isHovered ? "#1d4ed8" : "#0f172a")}
                                stroke={isSelected ? "#93c5fd" : (isHovered ? "#60a5fa" : "#334155")}
                                strokeWidth={isSelected ? "1.8" : "1.2"}
                                className="shadow-md"
                              />
                              <text
                                x="0"
                                y="4"
                                fill="#ffffff"
                                textAnchor="middle"
                                fontSize="10"
                                fontFamily="Tajawal"
                                fontWeight="bold"
                              >
                                {fmt(seg.lengthCm)}
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    })}

                    {/* 2. Interactive Anchor Points / Movable Nodes */}
                    {piece.segments.map(seg => {
                      const isP1Selected = selectedNode?.pieceId === piece.id && selectedNode?.segId === seg.id && selectedNode?.pointKey === 'p1';
                      const isP1Hovered = hoveredNode?.pieceId === piece.id && hoveredNode?.segId === seg.id && hoveredNode?.pointKey === 'p1';

                      const isP2Selected = selectedNode?.pieceId === piece.id && selectedNode?.segId === seg.id && selectedNode?.pointKey === 'p2';
                      const isP2Hovered = hoveredNode?.pieceId === piece.id && hoveredNode?.segId === seg.id && hoveredNode?.pointKey === 'p2';

                      const isCp1Selected = selectedNode?.pieceId === piece.id && selectedNode?.segId === seg.id && selectedNode?.pointKey === 'cp1';
                      const isCp2Selected = selectedNode?.pieceId === piece.id && selectedNode?.segId === seg.id && selectedNode?.pointKey === 'cp2';

                      return (
                        <g key={`nodes-${seg.id}`}>
                          {/* Node P1 */}
                          <g transform={`translate(${seg.p1.x * pxPerCm}, ${seg.p1.y * pxPerCm})`}>
                            {(isP1Selected || isP1Hovered) && (
                              <circle
                                r="10"
                                fill="none"
                                stroke={isP1Selected ? "#0ea5e9" : "#38bdf8"}
                                strokeWidth="2"
                                className="animate-pulse opacity-75"
                              />
                            )}
                            <circle
                              r={isP1Selected ? 6.5 : (activeTool === 'select_move' ? 5.5 : 4.5)}
                              fill={isP1Selected ? "#0ea5e9" : "#38bdf8"}
                              stroke="#ffffff"
                              strokeWidth={isP1Selected ? 2 : 1.5}
                              className="cursor-move hover:scale-125 transition-transform"
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                setSelectedNode({ pieceId: piece.id, segId: seg.id, pointKey: 'p1' });
                                setIsDraggingNode(true);
                              }}
                              onTouchStart={(e) => {
                                e.stopPropagation();
                                setSelectedNode({ pieceId: piece.id, segId: seg.id, pointKey: 'p1' });
                                setIsDraggingNode(true);
                              }}
                              onMouseEnter={() => setHoveredNode({ pieceId: piece.id, segId: seg.id, pointKey: 'p1', coords: seg.p1 })}
                              onMouseLeave={() => setHoveredNode(null)}
                            />
                            {(isP1Selected || isP1Hovered) && (
                              <g transform="translate(10, -12)" className="pointer-events-none">
                                <rect x="0" y="-12" width="76" height="18" rx="4" fill="rgba(15,23,42,0.9)" stroke="#38bdf8" strokeWidth="1" />
                                <text x="38" y="0" fill="#ffffff" textAnchor="middle" fontSize="9" fontWeight="bold" fontFamily="monospace">
                                  {seg.p1.x}, {seg.p1.y}
                                </text>
                              </g>
                            )}
                          </g>

                          {/* Node P2 */}
                          <g transform={`translate(${seg.p2.x * pxPerCm}, ${seg.p2.y * pxPerCm})`}>
                            {(isP2Selected || isP2Hovered) && (
                              <circle
                                r="10"
                                fill="none"
                                stroke={isP2Selected ? "#0ea5e9" : "#38bdf8"}
                                strokeWidth="2"
                                className="animate-pulse opacity-75"
                              />
                            )}
                            <circle
                              r={isP2Selected ? 6.5 : (activeTool === 'select_move' ? 5.5 : 4.5)}
                              fill={isP2Selected ? "#0ea5e9" : "#38bdf8"}
                              stroke="#ffffff"
                              strokeWidth={isP2Selected ? 2 : 1.5}
                              className="cursor-move hover:scale-125 transition-transform"
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                setSelectedNode({ pieceId: piece.id, segId: seg.id, pointKey: 'p2' });
                                setIsDraggingNode(true);
                              }}
                              onTouchStart={(e) => {
                                e.stopPropagation();
                                setSelectedNode({ pieceId: piece.id, segId: seg.id, pointKey: 'p2' });
                                setIsDraggingNode(true);
                              }}
                              onMouseEnter={() => setHoveredNode({ pieceId: piece.id, segId: seg.id, pointKey: 'p2', coords: seg.p2 })}
                              onMouseLeave={() => setHoveredNode(null)}
                            />
                            {(isP2Selected || isP2Hovered) && (
                              <g transform="translate(10, -12)" className="pointer-events-none">
                                <rect x="0" y="-12" width="76" height="18" rx="4" fill="rgba(15,23,42,0.9)" stroke="#38bdf8" strokeWidth="1" />
                                <text x="38" y="0" fill="#ffffff" textAnchor="middle" fontSize="9" fontWeight="bold" fontFamily="monospace">
                                  {seg.p2.x}, {seg.p2.y}
                                </text>
                              </g>
                            )}
                          </g>

                          {/* Control Point 1 if quad/bezier */}
                          {seg.cp1 && (
                            <g>
                              <line
                                x1={seg.p1.x * pxPerCm}
                                y1={seg.p1.y * pxPerCm}
                                x2={seg.cp1.x * pxPerCm}
                                y2={seg.cp1.y * pxPerCm}
                                stroke="#c084fc"
                                strokeWidth="1.2"
                                strokeDasharray="3 3"
                              />
                              <circle
                                cx={seg.cp1.x * pxPerCm}
                                cy={seg.cp1.y * pxPerCm}
                                r={isCp1Selected ? 6.5 : 5}
                                fill="#c084fc"
                                stroke="#ffffff"
                                strokeWidth={isCp1Selected ? 2 : 1.2}
                                className="cursor-move hover:scale-125 transition-transform"
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  setSelectedNode({ pieceId: piece.id, segId: seg.id, pointKey: 'cp1' });
                                  setIsDraggingNode(true);
                                }}
                                onTouchStart={(e) => {
                                  e.stopPropagation();
                                  setSelectedNode({ pieceId: piece.id, segId: seg.id, pointKey: 'cp1' });
                                  setIsDraggingNode(true);
                                }}
                              />
                            </g>
                          )}

                          {/* Control Point 2 if cubic bezier */}
                          {seg.cp2 && (
                            <g>
                              <line
                                x1={seg.p2.x * pxPerCm}
                                y1={seg.p2.y * pxPerCm}
                                x2={seg.cp2.x * pxPerCm}
                                y2={seg.cp2.y * pxPerCm}
                                stroke="#c084fc"
                                strokeWidth="1.2"
                                strokeDasharray="3 3"
                              />
                              <circle
                                cx={seg.cp2.x * pxPerCm}
                                cy={seg.cp2.y * pxPerCm}
                                r={isCp2Selected ? 6.5 : 5}
                                fill="#c084fc"
                                stroke="#ffffff"
                                strokeWidth={isCp2Selected ? 2 : 1.2}
                                className="cursor-move hover:scale-125 transition-transform"
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  setSelectedNode({ pieceId: piece.id, segId: seg.id, pointKey: 'cp2' });
                                  setIsDraggingNode(true);
                                }}
                                onTouchStart={(e) => {
                                  e.stopPropagation();
                                  setSelectedNode({ pieceId: piece.id, segId: seg.id, pointKey: 'cp2' });
                                  setIsDraggingNode(true);
                                }}
                              />
                            </g>
                          )}
                        </g>
                      );
                    })}

                  {/* 3. Notches Layer */}
                  {layers.notches && piece.notches.map(notch => {
                    const nx = notch.point.x * pxPerCm;
                    const ny = notch.point.y * pxPerCm;
                    const d = notch.depthCm * pxPerCm;
                    return (
                      <g key={notch.id} transform={`translate(${nx}, ${ny}) rotate(${notch.angleDeg})`}>
                        {notch.type === 'v_notch' ? (
                          <polygon points={`0,0 -${d*0.6},-${d} ${d*0.6},-${d}`} fill="#f43f5e" stroke="#ffffff" strokeWidth="0.8" />
                        ) : (
                          <line x1="0" y1="0" x2="0" y2={-d * 1.5} stroke="#f43f5e" strokeWidth="2.5" strokeLinecap="round" />
                        )}
                        <text x="6" y="-4" fill="#f43f5e" fontSize="9" fontWeight="bold" fontFamily="Tajawal">
                          {notch.label}
                        </text>
                      </g>
                    );
                  })}

                  {/* 4. Grainlines Layer */}
                  {layers.notes && piece.grainlines.map(grain => (
                    <g key={grain.id}>
                      <line
                        x1={grain.p1.x * pxPerCm}
                        y1={grain.p1.y * pxPerCm}
                        x2={grain.p2.x * pxPerCm}
                        y2={grain.p2.y * pxPerCm}
                        stroke="#38bdf8"
                        strokeWidth="2"
                        markerStart="url(#cadArrowGrain)"
                        markerEnd="url(#cadArrowGrain)"
                      />
                      <text
                        x={(grain.p1.x + grain.p2.x) * 0.5 * pxPerCm + 8}
                        y={(grain.p1.y + grain.p2.y) * 0.5 * pxPerCm}
                        fill="#38bdf8"
                        fontSize="9"
                        fontFamily="Tajawal"
                        transform={`rotate(90, ${(grain.p1.x + grain.p2.x) * 0.5 * pxPerCm + 8}, ${(grain.p1.y + grain.p2.y) * 0.5 * pxPerCm})`}
                      >
                        {grain.label}
                      </text>
                    </g>
                  ))}

                  {/* Piece Nameplate */}
                  {layers.notes && piece.segments.length > 0 && (
                    <g transform={`translate(${piece.segments[0].p1.x * pxPerCm + 15}, ${piece.segments[0].p1.y * pxPerCm + 35})`}>
                      <rect width="130" height="34" rx="8" fill="rgba(15,23,42,0.85)" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                      <text x="65" y="15" fill="#ffffff" textAnchor="middle" fontSize="11" fontWeight="bold" fontFamily="Tajawal">
                        {piece.nameAr}
                      </text>
                      <text x="65" y="27" fill="#94a3b8" textAnchor="middle" fontSize="9" fontFamily="Tajawal">
                        بدل الخياطة: {fmt(piece.seamAllowanceCm)}
                      </text>
                    </g>
                  )}

                </g>
              );
            })}

              {/* Active Multi-Point Guided Draw Preview */}
              {drawingPoints.length > 0 && (
                <g>
                  {/* Placed segments */}
                  {drawingPoints.length > 1 && (
                    <polyline
                      points={drawingPoints.map(p => `${p.x * pxPerCm},${p.y * pxPerCm}`).join(' ')}
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {/* Active rubberband line to cursor */}
                  {activeCursorPos && (
                    <line
                      x1={drawingPoints[drawingPoints.length - 1].x * pxPerCm}
                      y1={drawingPoints[drawingPoints.length - 1].y * pxPerCm}
                      x2={activeCursorPos.x * pxPerCm}
                      y2={activeCursorPos.y * pxPerCm}
                      stroke="#38bdf8"
                      strokeWidth="2"
                      strokeDasharray="4 4"
                    />
                  )}

                  {/* Numbered point beacons */}
                  {drawingPoints.map((dp, idx) => {
                    const isStart = idx === 0;
                    const isNearStart = isStart && drawingPoints.length >= 2 && activeCursorPos && distance(activeCursorPos, dp) < 1.5;

                    return (
                      <g key={`dp-${idx}`} transform={`translate(${dp.x * pxPerCm}, ${dp.y * pxPerCm})`}>
                        {isNearStart ? (
                          <>
                            <circle r="12" fill="none" stroke="#10b981" strokeWidth="2.5" className="animate-ping opacity-75" />
                            <circle r="7" fill="#10b981" stroke="#ffffff" strokeWidth="2" />
                            <text x="12" y="4" fill="#10b981" fontSize="10" fontWeight="bold" fontFamily="Tajawal">
                              انقر للإغلاق (Enter)
                            </text>
                          </>
                        ) : (
                          <>
                            <circle r="6" fill="#0284c7" stroke="#ffffff" strokeWidth="1.5" />
                            <text x="0" y="3" fill="#ffffff" textAnchor="middle" fontSize="8" fontWeight="bold" fontFamily="Tajawal">
                              {idx + 1}
                            </text>
                          </>
                        )}
                      </g>
                    );
                  })}

                  {/* Floating cursor preview beacon */}
                  {activeCursorPos && (
                    <circle cx={activeCursorPos.x * pxPerCm} cy={activeCursorPos.y * pxPerCm} r="4" fill="#38bdf8" stroke="#ffffff" strokeWidth="1.5" />
                  )}
                </g>
              )}

              {/* Dynamic Axis Alignment Guides when dragging nodes */}
              {alignmentGuide && (
                <g className="pointer-events-none">
                  {alignmentGuide.x !== undefined && (
                    <line
                      x1={alignmentGuide.x * pxPerCm}
                      y1="0"
                      x2={alignmentGuide.x * pxPerCm}
                      y2={workFrame.heightCm * pxPerCm}
                      stroke="#f59e0b"
                      strokeWidth="1.5"
                      strokeDasharray="4 3"
                    />
                  )}
                  {alignmentGuide.y !== undefined && (
                    <line
                      x1="0"
                      y1={alignmentGuide.y * pxPerCm}
                      x2={workFrame.widthCm * pxPerCm}
                      y2={alignmentGuide.y * pxPerCm}
                      stroke="#f59e0b"
                      strokeWidth="1.5"
                      strokeDasharray="4 3"
                    />
                  )}
                </g>
              )}

              {/* Smart Snap Ring Indicator */}
              {activeSnapTarget && (
                <g transform={`translate(${activeSnapTarget.point.x * pxPerCm}, ${activeSnapTarget.point.y * pxPerCm})`}>
                  <circle r="9" fill="none" stroke="#10b981" strokeWidth="2" className="animate-ping opacity-75" />
                  <circle r="5" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />
                  <text x="8" y="-8" fill="#10b981" fontSize="9" fontWeight="bold" fontFamily="Tajawal">
                    {activeSnapTarget.type === 'vertex' ? 'نقطة (Snap)' : (activeSnapTarget.type === 'midpoint' ? 'منتصف (Mid)' : 'شبكة (Grid)')}
                  </text>
                </g>
              )}

              {/* Measure Points Visualization */}
              {measurePoints.length > 0 && (
                <g>
                  <circle cx={measurePoints[0].x * pxPerCm} cy={measurePoints[0].y * pxPerCm} r="6" fill="#a855f7" stroke="#ffffff" strokeWidth="2" />
                  {measurePoints[1] && (
                    <>
                      <circle cx={measurePoints[1].x * pxPerCm} cy={measurePoints[1].y * pxPerCm} r="6" fill="#a855f7" stroke="#ffffff" strokeWidth="2" />
                      <line
                        x1={measurePoints[0].x * pxPerCm}
                        y1={measurePoints[0].y * pxPerCm}
                        x2={measurePoints[1].x * pxPerCm}
                        y2={measurePoints[1].y * pxPerCm}
                        stroke="#a855f7"
                        strokeWidth="2.5"
                        strokeDasharray="4 3"
                        markerStart="url(#cadArrowDim)"
                        markerEnd="url(#cadArrowDim)"
                      />
                    </>
                  )}
                </g>
              )}

            </g>
          </svg>
        </div>

      </div>




    </div>
  );
}
