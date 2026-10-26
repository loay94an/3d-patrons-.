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

  // Split segment at specific point (Insert new vertex node)
  const handleSplitSegmentAtPoint = useCallback((pieceId: string, segId: string, splitPt: CadPoint) => {
    const updated = pieces.map(piece => {
      if (piece.id !== pieceId) return piece;

      const segIdx = piece.segments.findIndex(s => s.id === segId);
      if (segIdx === -1) return piece;

      const origSeg = piece.segments[segIdx];
      const ptSnap: CadPoint = { x: +splitPt.x.toFixed(2), y: +splitPt.y.toFixed(2) };

      const seg1: CadSegment = {
        ...origSeg,
        id: `seg_split_a_${Date.now()}`,
        p1: origSeg.p1,
        p2: ptSnap,
        type: 'line',
        cp1: undefined,
        cp2: undefined,
        lengthCm: +distance(origSeg.p1, ptSnap).toFixed(1),
        label: `قسم 1 (${+distance(origSeg.p1, ptSnap).toFixed(1)} سم)`
      };

      const seg2: CadSegment = {
        ...origSeg,
        id: `seg_split_b_${Date.now()}`,
        p1: ptSnap,
        p2: origSeg.p2,
        type: 'line',
        cp1: undefined,
        cp2: undefined,
        lengthCm: +distance(ptSnap, origSeg.p2).toFixed(1),
        label: `قسم 2 (${+distance(ptSnap, origSeg.p2).toFixed(1)} سم)`
      };

      const newSegs = [...piece.segments];
      newSegs.splice(segIdx, 1, seg1, seg2);
      return { ...piece, segments: newSegs };
    });

    setPieces(updated);
    pushHistory('إضافة نقطة ارتكاز جديدة (تقسيم الخط)', updated);
  }, [pieces]);

  // Delete selected node
  const handleDeleteSelectedNode = useCallback(() => {
    if (!selectedNode) return;
    const { pieceId, segId, pointKey } = selectedNode;

    const updated = pieces.map(piece => {
      if (piece.id !== pieceId) return piece;

      if (pointKey === 'cp1' || pointKey === 'cp2') {
        const updatedSegs = piece.segments.map(s => {
          if (s.id === segId) {
            return {
              ...s,
              type: 'line' as const,
              cp1: undefined,
              cp2: undefined,
              lengthCm: +distance(s.p1, s.p2).toFixed(1)
            };
          }
          return s;
        });
        return { ...piece, segments: updatedSegs };
      }

      const segIdx = piece.segments.findIndex(s => s.id === segId);
      if (segIdx === -1) return piece;
      if (piece.segments.length <= 2) return piece;

      const curSeg = piece.segments[segIdx];
      const targetPoint = curSeg[pointKey];

      const otherIdx = piece.segments.findIndex((s, idx) => 
        idx !== segIdx && (distance(s.p1, targetPoint) < 0.3 || distance(s.p2, targetPoint) < 0.3)
      );

      if (otherIdx !== -1) {
        const otherSeg = piece.segments[otherIdx];
        const mergedP1 = distance(otherSeg.p1, targetPoint) < 0.3 ? otherSeg.p2 : otherSeg.p1;
        const mergedP2 = distance(curSeg.p1, targetPoint) < 0.3 ? curSeg.p2 : curSeg.p1;

        const mergedSeg: CadSegment = {
          ...curSeg,
          id: `seg_merged_${Date.now()}`,
          p1: mergedP1,
          p2: mergedP2,
          type: 'line',
          cp1: undefined,
          cp2: undefined,
          lengthCm: +distance(mergedP1, mergedP2).toFixed(1),
          label: `مدمج: ${+distance(mergedP1, mergedP2).toFixed(1)} سم`
        };

        const newSegs = piece.segments.filter((_, idx) => idx !== segIdx && idx !== otherIdx);
        newSegs.splice(Math.min(segIdx, otherIdx), 0, mergedSeg);
        return { ...piece, segments: newSegs };
      }

      return piece;
    });

    setPieces(updated);
    setSelectedNode(null);
    pushHistory('حذف نقطة ارتكاز ودمج المسارات', updated);
  }, [selectedNode, pieces]);

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
  const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent, referenceStartPt?: CadPoint | null): CadPoint | null => {
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
    const snap = getSnapTarget(rawPt);
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
        const updated = [...pieces];
        if (updated.length > 0) {
          updated[0].segments.push(newSeg);
        } else {
          updated.push({
            id: `piece_custom_${Date.now()}`,
            name: 'Custom Piece',
            nameAr: 'قطعة هندسية مخصصة',
            garmentType: 'custom',
            segments: [newSeg],
            notches: [],
            grainlines: [],
            seamAllowanceCm: 1.5,
            notes: 'رسم منحنى قياسي'
          });
        }
        setPieces(updated);
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
        const updated = [...pieces];
        if (updated.length > 0) {
          updated[0].segments.push(newSeg);
        } else {
          updated.push({
            id: `piece_custom_${Date.now()}`,
            name: 'Custom Piece',
            nameAr: 'قطعة هندسية مخصصة',
            garmentType: 'custom',
            segments: [newSeg],
            notches: [],
            grainlines: [],
            seamAllowanceCm: 1.5,
            notes: 'رسم منحنى بيزيه'
          });
        }
        setPieces(updated);
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
            setSelectedNode({ pieceId: piece.id, segId: seg.id, pointKey: 'p1' });
            handleDeleteSelectedNode();
            return;
          }
          if (distance(pt, seg.p2) < 2.0) {
            setSelectedNode({ pieceId: piece.id, segId: seg.id, pointKey: 'p2' });
            handleDeleteSelectedNode();
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
        const updated = [...pieces];
        updated[0].notches.push(newNotch);
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
        const updated = [...pieces];
        updated[0].grainlines.push(newGrain);
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
    const pt = getCanvasCoords(e, refPt);
    if (pt) setActiveCursorPos(pt);

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
    setIsPanning(false);
    setTouchDistance(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
    setZoom(z => Math.max(0.3, Math.min(3.5, z * zoomFactor)));
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
      
      {/* 1. TOP PERIMETER HEADER (الشريط العلوي الثابت) */}
      <div className="bg-slate-900 border-b border-slate-800 p-2.5 sm:p-3 flex flex-wrap items-center justify-between gap-2.5 text-white z-10 shrink-0">
        
        {/* Left Side: Branding & Model Tag */}
        <div className="flex items-center gap-2 sm:gap-3">
          {onBackToCalculator && (
            <button
              onClick={onBackToCalculator}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold border border-slate-700 transition-all active:scale-95"
              title="العودة لجدول القياسات"
            >
              <ArrowLeft className="w-4 h-4 text-blue-400" />
              <span className="hidden sm:inline">جدول القياسات</span>
            </button>
          )}

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-black text-slate-100">استوديو رسم الباترون (CAD)</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {state.garment} | {workFrame.widthCm}×{workFrame.heightCm} سم
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Center: Layers Visibility Toolbar (رموز ثابتة للطبقات) */}
        <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/80 text-xs overflow-x-auto">
          <button
            onClick={() => setLayers(l => ({ ...l, grid: !l.grid }))}
            className={`p-1.5 px-2 rounded-lg font-bold flex items-center gap-1 transition-all ${layers.grid ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
            title="إظهار / إخفاء الشبكة"
          >
            <Grid className="w-3.5 h-3.5" />
            <span className="text-[11px] hidden md:inline">شبكة</span>
          </button>
          <button
            onClick={() => setLayers(l => ({ ...l, rulers: !l.rulers }))}
            className={`p-1.5 px-2 rounded-lg font-bold flex items-center gap-1 transition-all ${layers.rulers ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
            title="إظهار / إخفاء مساطر القياس"
          >
            <Ruler className="w-3.5 h-3.5" />
            <span className="text-[11px] hidden md:inline">مساطر</span>
          </button>
          <button
            onClick={() => setLayers(l => ({ ...l, cutting: !l.cutting }))}
            className={`p-1.5 px-2 rounded-lg font-bold flex items-center gap-1 transition-all ${layers.cutting ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
            title="خطوط القص الأساسية"
          >
            <Scissors className="w-3.5 h-3.5" />
            <span className="text-[11px] hidden md:inline">قص</span>
          </button>
          <button
            onClick={() => setLayers(l => ({ ...l, stitch: !l.stitch }))}
            className={`p-1.5 px-2 rounded-lg font-bold flex items-center gap-1 transition-all ${layers.stitch ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
            title="خطوط الخياطة وسماحات الحواف"
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="text-[11px] hidden md:inline">خياطة</span>
          </button>
          <button
            onClick={() => setLayers(l => ({ ...l, notches: !l.notches }))}
            className={`p-1.5 px-2 rounded-lg font-bold flex items-center gap-1 transition-all ${layers.notches ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
            title="علامات النوتش والتركيب"
          >
            <span className="text-[11px] font-mono">V</span>
            <span className="text-[11px] hidden md:inline">نوتش</span>
          </button>
          <button
            onClick={() => setLayers(l => ({ ...l, dimensions: !l.dimensions }))}
            className={`p-1.5 px-2 rounded-lg font-bold flex items-center gap-1 transition-all ${layers.dimensions ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
            title="بطاقات القياسات الرقمية"
          >
            <span className="text-[10px] font-mono font-bold">123</span>
            <span className="text-[11px] hidden md:inline">قياسات</span>
          </button>
        </div>

        {/* Right Side: Center in View, Zoom, Canvas Sizing, Modals & Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          
          {/* AUTO-CENTER PATTERN BUTTON (توسيط النمط في وسط الشاشة) */}
          <button
            onClick={handleCenterAndFitPattern}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 active:scale-95 transition-all border border-blue-400/40"
            title="توسيط وملاءمة النمط في منتصف الشاشة بدون أي حجب"
          >
            <Crosshair className="w-3.5 h-3.5 text-amber-300" />
            <span className="text-xs font-black">توسيط النمط</span>
          </button>

          {/* Undo / Redo */}
          <div className="flex items-center bg-slate-800 rounded-xl border border-slate-700 p-0.5">
            <button
              onClick={handleUndo}
              disabled={historyIndex === 0}
              className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="تراجع (Ctrl+Z)"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleRedo}
              disabled={historyIndex >= historyStack.length - 1}
              className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="إعادة (Ctrl+Y)"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center bg-slate-800 rounded-xl border border-slate-700 p-0.5">
            <button
              onClick={() => setZoom(z => Math.min(z * 1.15, 3.5))}
              className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors"
              title="تكبير"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <span className="text-[10px] font-mono px-1.5 text-slate-300 font-bold min-w-9 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(z => Math.max(z * 0.85, 0.3))}
              className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors"
              title="تصغير"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={handleCenterAndFitPattern}
              className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors border-r border-slate-700"
              title="إعادة ضبط وملاءمة الرؤية"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Canvas Height Resizing Presets */}
          <div className="hidden lg:flex items-center bg-slate-800 rounded-xl border border-slate-700 p-0.5 text-xs">
            <button
              onClick={() => { setCanvasHeightMode('compact'); setTimeout(handleCenterAndFitPattern, 80); }}
              className={`px-2 py-1 rounded-lg font-bold text-[11px] transition-colors ${canvasHeightMode === 'compact' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
              title="مساحة رسم مدمجة (520px)"
            >
              مدمج
            </button>
            <button
              onClick={() => { setCanvasHeightMode('medium'); setTimeout(handleCenterAndFitPattern, 80); }}
              className={`px-2 py-1 rounded-lg font-bold text-[11px] transition-colors ${canvasHeightMode === 'medium' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
              title="مساحة رسم قياسية (680px)"
            >
              متوسط
            </button>
            <button
              onClick={() => { setCanvasHeightMode('large'); setTimeout(handleCenterAndFitPattern, 80); }}
              className={`px-2 py-1 rounded-lg font-bold text-[11px] transition-colors ${canvasHeightMode === 'large' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
              title="مساحة رسم واسعة (880px)"
            >
              كبير
            </button>
          </div>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => {
              setCanvasHeightMode(m => m === 'fullscreen' ? 'medium' : 'fullscreen');
              setTimeout(handleCenterAndFitPattern, 100);
            }}
            className={`p-1.5 rounded-xl border transition-all flex items-center justify-center ${
              canvasHeightMode === 'fullscreen'
                ? 'bg-amber-600 text-white border-amber-400 shadow-md'
                : 'bg-slate-800 text-slate-300 hover:text-white border-slate-700'
            }`}
            title={canvasHeightMode === 'fullscreen' ? 'إنهاء وضع ملء الشاشة (Esc)' : 'تكبير وملء الشاشة بالكامل'}
          >
            {canvasHeightMode === 'fullscreen' ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Pattern by Numbers Modal Button */}
          <button
            onClick={() => setShowNumbersModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 text-white rounded-xl text-xs font-black shadow-md active:scale-95 transition-all"
            title="تعديل القياسات بالأرقام"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span className="hidden sm:inline">PatternByNumbers</span>
          </button>

          {/* Tile Print */}
          <button
            onClick={() => setShowTilePrintModal(true)}
            className="p-1.5 sm:px-2.5 sm:py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold border border-slate-700 transition-all flex items-center gap-1"
            title="طباعة مجزأة A4"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden md:inline">طباعة A4</span>
          </button>

          {/* Side Panel Drawer Toggle Button */}
          <button
            onClick={() => setIsSidePanelOpen(!isSidePanelOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-sm ${
              isSidePanelOpen
                ? 'bg-blue-600 text-white border-blue-400 shadow-blue-500/20'
                : 'bg-slate-800 text-slate-200 hover:text-white border-slate-700'
            }`}
            title="فتح/إغلاق صندوق أدوات الرسم والتعديل الشامل"
          >
            <Sliders className="w-4 h-4 text-blue-400" />
            <span className="hidden md:inline">صندوق الأدوات</span>
          </button>

          {/* Quick Properties Toggle Button */}
          <button
            onClick={() => setShowQuickProperties(!showQuickProperties)}
            className={`p-1.5 px-2.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1 ${
              showQuickProperties
                ? 'bg-purple-600 text-white border-purple-400 shadow-purple-500/20'
                : 'bg-slate-800 text-slate-300 hover:text-white border-slate-700'
            }`}
            title="إظهار/إخفاء لوحة الخصائص السريعة"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">الخصائص</span>
          </button>

          {/* SVG Download */}
          <button
            onClick={handleDownloadSVG}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl border border-slate-700 transition-all flex items-center justify-center"
            title="تحميل كملف SVG هندسي"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>

      </div>

      {/* PATTERNS & PIECES DEDICATED SELECTION BAR (شريط الأنماط وقطع الباترون السريعة) */}
      <div className="bg-slate-900 border-b border-slate-800/80 px-3 py-2 flex flex-wrap items-center justify-between gap-2.5 text-xs z-10 shrink-0">
        
        {/* Left: Quick Pattern Models (نماذج الأنماط) */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
          <span className="text-[11px] font-bold text-slate-400 shrink-0 ml-1">الأنماط الجاهزة:</span>
          
          <button
            onClick={() => {
              handleLoadTemplate('bodice');
              setTimeout(handleCenterAndFitPattern, 100);
            }}
            className={`px-2.5 py-1 rounded-xl font-bold text-xs transition-all active:scale-95 flex items-center gap-1 shrink-0 shadow-sm border ${
              activeGarmentType === 'bodice'
                ? 'bg-blue-600 text-white border-blue-400 shadow-blue-500/20'
                : 'bg-slate-800 text-slate-200 hover:text-white hover:bg-slate-700 border-slate-700'
            }`}
          >
            <span>👚</span>
            <span>كورساج أساسي</span>
          </button>

          <button
            onClick={() => {
              handleLoadTemplate('dress');
              setTimeout(handleCenterAndFitPattern, 100);
            }}
            className={`px-2.5 py-1 rounded-xl font-bold text-xs transition-all active:scale-95 flex items-center gap-1 shrink-0 shadow-sm border ${
              activeGarmentType === 'dress'
                ? 'bg-blue-600 text-white border-blue-400 shadow-blue-500/20'
                : 'bg-slate-800 text-slate-200 hover:text-white hover:bg-slate-700 border-slate-700'
            }`}
          >
            <span>👗</span>
            <span>فستان نسائي</span>
          </button>

          <button
            onClick={() => {
              handleLoadTemplate('shirt');
              setTimeout(handleCenterAndFitPattern, 100);
            }}
            className={`px-2.5 py-1 rounded-xl font-bold text-xs transition-all active:scale-95 flex items-center gap-1 shrink-0 shadow-sm border ${
              activeGarmentType === 'shirt'
                ? 'bg-blue-600 text-white border-blue-400 shadow-blue-500/20'
                : 'bg-slate-800 text-slate-200 hover:text-white hover:bg-slate-700 border-slate-700'
            }`}
          >
            <span>👔</span>
            <span>قميص رجالي</span>
          </button>

          <button
            onClick={() => {
              handleLoadTemplate('pants');
              setTimeout(handleCenterAndFitPattern, 100);
            }}
            className={`px-2.5 py-1 rounded-xl font-bold text-xs transition-all active:scale-95 flex items-center gap-1 shrink-0 shadow-sm border ${
              activeGarmentType === 'pants'
                ? 'bg-blue-600 text-white border-blue-400 shadow-blue-500/20'
                : 'bg-slate-800 text-slate-200 hover:text-white hover:bg-slate-700 border-slate-700'
            }`}
          >
            <span>👖</span>
            <span>بنطال</span>
          </button>

          <button
            onClick={() => {
              handleLoadTemplate('skirt');
              setTimeout(handleCenterAndFitPattern, 100);
            }}
            className={`px-2.5 py-1 rounded-xl font-bold text-xs transition-all active:scale-95 flex items-center gap-1 shrink-0 shadow-sm border ${
              activeGarmentType === 'skirt'
                ? 'bg-blue-600 text-white border-blue-400 shadow-blue-500/20'
                : 'bg-slate-800 text-slate-200 hover:text-white hover:bg-slate-700 border-slate-700'
            }`}
          >
            <span>✨</span>
            <span>تنورة كلوش</span>
          </button>
        </div>

        {/* Right: Pattern Pieces (قطع الباترون) */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
          <span className="text-[11px] font-bold text-slate-400 shrink-0 ml-1">قطع الباترون ({pieces.length}):</span>
          <button
            onClick={() => {
              setSelectedPieceId(null);
              setSelectedSegmentId(null);
              setTimeout(handleCenterAndFitPattern, 80);
            }}
            className={`px-2.5 py-1 rounded-xl font-bold text-xs transition-all shrink-0 ${
              !selectedPieceId
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 ring-1 ring-blue-400'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
            }`}
          >
            عرض الكل
          </button>
          {pieces.map(p => (
            <button
              key={p.id}
              onClick={() => {
                setSelectedPieceId(p.id);
                setTimeout(handleCenterAndFitPattern, 80);
              }}
              className={`px-2.5 py-1 rounded-xl font-bold text-xs transition-all shrink-0 ${
                selectedPieceId === p.id
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 ring-1 ring-blue-400'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
              }`}
            >
              {p.nameAr}
            </button>
          ))}
        </div>

      </div>

      {/* 2. MAIN CAD WORKSPACE (لوحة العمل المركزية مع أشرطة الأدوات الثابتة على الأطراف) */}
      <div
        className="flex flex-row w-full flex-1 h-full min-h-0 relative overflow-hidden"
      >
        
        {/* FIXED PERIMETER TOOLBAR (شريط الأدوات الجانبي الثابت على الطرف - رموز ثابتة) */}
        <div className="w-14 sm:w-16 bg-slate-900 border-l border-slate-800 flex flex-col items-center py-2 px-1 gap-1.5 z-10 shrink-0 overflow-y-auto">
          {perimeterTools.map(tool => {
            const isActive = activeTool === tool.id;
            return (
              <button
                key={tool.id}
                onClick={() => setActiveTool(tool.id)}
                className={`w-11 sm:w-12 h-11 sm:h-12 rounded-2xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-all active:scale-95 group relative ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 ring-2 ring-blue-400'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
                }`}
                title={tool.tooltip}
              >
                {tool.icon}
                <span className="scale-90 font-medium">{tool.label}</span>
                
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
            className={`w-11 sm:w-12 h-11 sm:h-12 rounded-2xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-all active:scale-95 ${
              snapEnabled
                ? 'bg-emerald-600/30 border border-emerald-500/50 text-emerald-300'
                : 'text-slate-500 hover:bg-slate-800'
            }`}
            title={snapEnabled ? 'الجذب الذكي مفعّل (Smart Snap ON)' : 'الجذب الذكي معطّل (Smart Snap OFF)'}
          >
            <Magnet className="w-5 h-5" />
            <span className="scale-85">مغناطيس</span>
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
            className="w-11 sm:w-12 h-11 sm:h-12 rounded-2xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-all active:scale-95"
            title="سجل التعديلات والخطوات"
          >
            <RotateCw className="w-5 h-5" />
            <span className="scale-85">السجل</span>
          </button>
        </div>

        {/* CENTER UNOBSTRUCTED CANVAS (مساحة عرض الباترون الصافية والنظيفة تماماً) */}
        <div
          ref={containerRef}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onWheel={handleWheel}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
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
                          onMouseEnter={() => setHoveredSegment(seg)}
                          onMouseLeave={() => setHoveredSegment(null)}
                          onClick={(e) => {
                            e.stopPropagation();
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

      {/* 3. BOTTOM PERIMETER STATUS BAR (الشريط السفلي الثابت - يعرض معلومات ومقاييس الباترون خارج مساحة العمل) */}
      <div className="bg-slate-900 border-t border-slate-800 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 z-10 shrink-0">
        
        {/* Left: Active Tool Info & Live Dynamic Measurements */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 text-slate-300 font-bold">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span>
              {activeTool === 'select_move' && 'أداة التحديد والتحريك: اسحب أي نقطة زرقاء أو خط لتحريكه بدقة'}
              {activeTool === 'draw_line' && 'أداة رسم الخطوط: انقر لوضع نقاط المسار ثم اضغط Enter لإنهاء الشكل'}
              {activeTool === 'draw_quad' && 'أداة المنحنى: انقر لتحديد البداية، النهاية، ثم نقطة التقويس'}
              {activeTool === 'draw_bezier' && 'أداة بيزيه: انقر لتحديد 4 نقاط لتشكيل منحنى دقيق'}
              {activeTool === 'add_notch' && 'أداة النوتش: انقر على أي حافة لإضافة علامة تركيب'}
              {activeTool === 'add_grainline' && 'أداة النسيج: انقر لإضافة خط اتجاه النسيج الطولي'}
              {activeTool === 'measure_tool' && 'أداة القياس: انقر على نقطتين لقياس المسافة بينهما'}
              {activeTool === 'seam_allowance' && 'سماحات الخياطة: حدد الحافة لتعديل البدل'}
            </span>
          </div>

          {/* Active Polyline Drawing Controls in Status Bar */}
          {drawingPoints.length > 0 && (
            <div className="flex items-center gap-1.5 bg-blue-950/80 border border-blue-500/50 rounded-lg px-2.5 py-1 text-xs text-white">
              <span className="font-bold text-blue-300">نقاط مرسومة: {drawingPoints.length}</span>
              {activeCursorPos && (
                <span className="text-blue-200 text-[11px] font-mono">
                  ({fmt(distance(drawingPoints[drawingPoints.length - 1], activeCursorPos))} | {Math.round(angleBetween(drawingPoints[drawingPoints.length - 1], activeCursorPos))}°)
                </span>
              )}
              <button
                onClick={() => handleFinishPolyline(true)}
                className="flex items-center gap-1 px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold transition-all text-[11px]"
                title="إغلاق الشكل وإنشاء قطعة باترون متكاملة"
              >
                <CheckCircle2 className="w-3 h-3" />
                <span>إغلاق القطعة (Enter)</span>
              </button>
              {drawingPoints.length >= 2 && (
                <button
                  onClick={() => handleFinishPolyline(false)}
                  className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-[11px] font-bold"
                  title="إنهاء كمسار مفتوح"
                >
                  مسار مفتوح
                </button>
              )}
              <button
                onClick={() => setDrawingPoints([])}
                className="px-1.5 py-0.5 bg-rose-950 hover:bg-rose-800 text-rose-300 rounded text-[11px]"
                title="إلغاء الرسم (Esc)"
              >
                إلغاء
              </button>
            </div>
          )}

          {/* Active Node Controls when a node is selected */}
          {selectedNode && (
            <div className="flex items-center gap-1.5 bg-slate-800 border border-sky-500/50 rounded-lg px-2.5 py-1 text-xs text-white">
              <span className="w-2 h-2 rounded-full bg-sky-400" />
              <span className="font-bold text-sky-300">نقطة ارتكاز محددة:</span>
              <span className="text-slate-300 text-[11px] hidden sm:inline">اسحب بالماوس أو حرّك بالأسهم (↑ ↓ ← →)</span>
              <button
                onClick={handleToggleNodeType}
                className="flex items-center gap-1 px-2 py-0.5 bg-purple-600 hover:bg-purple-500 text-white rounded font-bold text-[11px]"
                title="تبديل القطاع بين خط مستقيم ومنحنى"
              >
                <Wand2 className="w-3 h-3" />
                <span>تبديل منحنى/مستقيم</span>
              </button>
              <button
                onClick={handleDeleteSelectedNode}
                className="flex items-center gap-1 px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded font-bold text-[11px]"
                title="حذف هذه النقطة ودمج المسار (Delete/Backspace)"
              >
                <Trash2 className="w-3 h-3" />
                <span>حذف النقطة</span>
              </button>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-slate-400 hover:text-white px-1 text-xs"
                title="إلغاء تحديد النقطة (Esc)"
              >
                ✕
              </button>
            </div>
          )}

          {/* Free Measure Result outside canvas */}
          {measureResult !== null && (
            <div className="flex items-center gap-1.5 bg-purple-900/60 border border-purple-500/40 text-purple-200 px-2.5 py-0.5 rounded-lg font-bold text-[11px]">
              <Compass className="w-3 h-3" />
              <span>المسافة المقاسة: {fmt(measureResult)}</span>
            </div>
          )}

          {/* Active Segment Quick Editor in Status Bar */}
          {selectedSegment && (
            <div className="flex items-center gap-2 bg-slate-800 border border-blue-500/50 rounded-lg px-2 py-0.5 text-xs text-white">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              <span className="font-bold text-blue-300">{selectedSegment.label || 'المسار المحدد'}:</span>
              <input
                type="number"
                step="0.1"
                placeholder={`${selectedSegment.lengthCm}`}
                value={editLengthVal}
                onChange={(e) => setEditLengthVal(parseFloat(e.target.value) || '')}
                className="w-14 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 font-mono font-bold text-center text-xs outline-none focus:ring-1 focus:ring-blue-400"
              />
              <button
                onClick={() => {
                  if (typeof editLengthVal === 'number' && editLengthVal > 0) {
                    handleUpdateSegmentLength(selectedSegment.id, editLengthVal);
                  }
                }}
                className="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded text-xs active:scale-95 transition-all"
              >
                تطبيق
              </button>
              <button
                onClick={() => setSelectedSegmentId(null)}
                className="text-slate-400 hover:text-white px-1"
                title="إلغاء التحديد"
              >
                ✕
              </button>
            </div>
          )}

          {activeCursorPos && (
            <span className="font-mono text-blue-400 text-[11px] bg-slate-800 px-2 py-0.5 rounded-md hidden lg:inline">
              X: {activeCursorPos.x} سم | Y: {activeCursorPos.y} سم
            </span>
          )}
        </div>

        {/* Right: Specs Table Expander Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSpecsTable(!showSpecsTable)}
            className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold border border-slate-700 transition-all"
          >
            <FileText className="w-3.5 h-3.5 text-purple-400" />
            <span>{showSpecsTable ? 'إخفاء جدول المواصفات' : 'عرض جدول المواصفات الرقمية'}</span>
            {showSpecsTable ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>

      </div>

      {/* 4. EXPANDABLE SPECIFICATIONS TABLE (جدول المواصفات الكامل تحت اللوحة) */}
      {showSpecsTable && (
        <div className="bg-slate-900 border-t border-slate-800 p-4 sm:p-6 text-slate-100 transition-all animate-in slide-in-from-bottom-3">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <h4 className="font-black text-sm text-slate-100 flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-400" />
                <span>جدول المواصفات الهندسية لقطع الباترون</span>
              </h4>
              <p className="text-[11px] text-slate-400">قائمة تفصيلية بأبعاد وسماحات خياطة ونوتشات كل قطعة</p>
            </div>

            <button
              onClick={handleCopySummaryText}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 transition-all active:scale-95"
            >
              {copySuccess ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-blue-400" />}
              <span>{copySuccess ? 'تم النسخ!' : 'نسخ القائمة'}</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-800/80 text-slate-300 font-bold border-b border-slate-800">
                <tr>
                  <th className="p-2.5">#</th>
                  <th className="p-2.5">اسم القطعة</th>
                  <th className="p-2.5">الطول</th>
                  <th className="p-2.5">العرض</th>
                  <th className="p-2.5">سماحة الخياطة</th>
                  <th className="p-2.5">النوتشات</th>
                  <th className="p-2.5">ملاحظات القص</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {summaries.map((s, idx) => (
                  <tr key={s.pieceId} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-2.5 font-mono font-bold text-blue-400">{idx + 1}</td>
                    <td className="p-2.5 font-bold text-white">
                      <span>{s.nameAr}</span>
                      <span className="block text-[10px] text-slate-400 font-normal">{s.nameEn}</span>
                    </td>
                    <td className="p-2.5 font-mono font-bold text-slate-200">{fmt(s.lengthCm)}</td>
                    <td className="p-2.5 font-mono font-bold text-slate-200">{fmt(s.widthCm)}</td>
                    <td className="p-2.5 font-mono text-emerald-400 font-bold">{fmt(s.seamAllowanceCm)}</td>
                    <td className="p-2.5 font-mono">
                      <span className="px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 font-bold">
                        {s.notchesCount}
                      </span>
                    </td>
                    <td className="p-2.5 text-slate-300 text-[11px] max-w-xs">
                      {s.notesAr}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      <PatternByNumbersModal
        isOpen={showNumbersModal}
        onClose={() => setShowNumbersModal(false)}
        currentInput={patternInputs}
        onApply={handleApplyPatternNumbers}
        currentRules={draftingRules}
        unit={state.unit}
      />

      <TilePrintModal
        isOpen={showTilePrintModal}
        onClose={() => setShowTilePrintModal(false)}
        pieces={pieces}
        workFrame={workFrame}
        svgRef={svgRef}
      />

      <CadHistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        historyStack={historyStack}
        currentIndex={historyIndex}
        onJumpToStep={(idx) => {
          setHistoryIndex(idx);
          setPieces(historyStack[idx].pieces);
        }}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />

      {/* Side Tool Panel Drawer */}
      <CadSidePanel
        isOpen={isSidePanelOpen}
        onToggle={() => setIsSidePanelOpen(!isSidePanelOpen)}
        activeTool={activeTool}
        onSelectTool={(tool) => setActiveTool(tool)}
        isAdvancedMode={isAdvancedMode}
        onToggleAdvancedMode={() => setIsAdvancedMode(!isAdvancedMode)}
        seamAllowanceCm={seamAllowanceCm}
        onSeamAllowanceChange={(val) => setSeamAllowanceCm(val)}
        onApplySeamAllowance={handleApplySeamAllowance}
        onOpenPatternByNumbers={() => setShowNumbersModal(true)}
        onOpenHistory={() => setShowHistoryModal(true)}
        onOpenTilePrint={() => setShowTilePrintModal(true)}
        onOpenTemplate={(tplId) => handleLoadTemplate(tplId as any)}
      />

      {/* Floating Properties Panel */}
      {showQuickProperties && (
        <CadFloatingProperties
          activeTool={activeTool}
          selectedSegment={selectedSegment}
          selectedPiece={selectedPiece}
          onUpdateSegmentLength={handleUpdateSegmentLength}
          onUpdateEdgeSeam={handleUpdateEdgeSeam}
          axisLock={axisLock}
          onToggleAxisLock={(lock) => setAxisLock(lock)}
          curvatureStrength={curvatureStrength}
          onCurvatureStrengthChange={(val) => setCurvatureStrength(val)}
          mirrorSynced={mirrorSynced}
          onToggleMirrorSync={() => setMirrorSynced(!mirrorSynced)}
          unit={state.unit}
        />
      )}

    </div>
  );
}
