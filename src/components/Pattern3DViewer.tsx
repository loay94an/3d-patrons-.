import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import {
  RotateCcw, Eye, EyeOff, Camera, Layers,
  Activity, Play, Pause, Compass, ZoomIn, ZoomOut,
  Maximize2, Sparkles, Scissors, Shirt, Download, Palette, Sliders
} from 'lucide-react';
import { AppState, Gender } from '../lib/pattern-logic';
import { FabricCustomState, createFabricThreeMaterial, FABRIC_PRESETS } from '../lib/fabric-engine';
import { resolve3DMeasurements } from '../lib/mannequin-builder';
import { generate3DGarmentMesh, Garment3DResult } from '../lib/garment-3d-generator';
import { conformGarmentGroupToBody } from '../lib/garment-anny-fit';
import { buildAnnyCalibrationCandidates, getAnnyHeightScale, resolveAnnyTargetHeightCm } from '../lib/anny-measurement-fit';
import { calibrateAnnyBodyGeometry, type AnnyBodyCalibrationResult } from '../lib/anny-body-calibration';
import { buildAnnyBodyProfile } from '../lib/anny-body-profile';
import { loadCadProjectDocument, saveCadProjectDocument, type CadProjectDocument } from '../lib/cad-project-document';
import { auditCadSewing, createCadStitchPairFromSuggestion, type CadSeamSuggestion, type CadSewingAudit } from '../lib/cad-sewing-engine';
import type { CadPiece } from '../lib/pattern-cad-engine';
import { buildCadPanelGeometry, type CadPanelGeometry } from '../lib/cad-panel-geometry';
import type { AnnyCalibrationCandidate, AnnyProfileReport } from '../lib/anny-measurement-fit';
import { ReferenceModelLibrary } from './ReferenceModelLibrary';

/**
 * Releases GPU-backed resources owned by a Three.js subtree.
 * Canvas textures (fabric color and bump maps) must be disposed separately
 * from their materials or repeated garment edits accumulate GPU memory.
 */
function disposeObjectResources(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();

  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.Line)) return;

    geometries.add(object.geometry);
    const objectMaterials = Array.isArray(object.material)
      ? object.material
      : [object.material];

    objectMaterials.forEach((material) => {
      materials.add(material);
      Object.values(material).forEach((value) => {
        if (value instanceof THREE.Texture) textures.add(value);
      });
    });
  });

  textures.forEach((texture) => texture.dispose());
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}


function createCadPanelBufferGeometry(panel: CadPanelGeometry): THREE.BufferGeometry {
  const positions = new Float32Array(panel.vertices.length * 3);
  const uvs = new Float32Array(panel.vertices.length * 2);
  const width = Math.max(panel.bounds.maxX - panel.bounds.minX, 1e-8);
  const height = Math.max(panel.bounds.maxY - panel.bounds.minY, 1e-8);

  panel.vertices.forEach((point, index) => {
    positions[index * 3] = point.x;
    positions[index * 3 + 1] = point.y;
    positions[index * 3 + 2] = 0;
    uvs[index * 2] = (point.x - panel.bounds.minX) / width;
    uvs[index * 2 + 1] = (point.y - panel.bounds.minY) / height;
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(panel.triangleIndices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  // Keep CAD segment IDs and sampled boundary vertices alongside the render mesh.
  // The same mapping will be used later to assemble sewn panels without re-identifying edges.
  geometry.userData.cadPanel = {
    pieceId: panel.pieceId,
    garmentType: panel.garmentType,
    unit: panel.unit,
    seamAllowanceCm: panel.seamAllowanceCm,
    areaCm2: panel.areaCm2,
    boundaryEdges: panel.boundaryEdges
  };
  return geometry;
}

function buildCadPiecePreview(pieces: CadPiece[]): THREE.Group {
  const root = new THREE.Group();
  root.name = 'saved-cad-piece-preview';
  let cursorX = 0;
  let cursorZ = 0;
  let rowDepth = 0;
  pieces.forEach((piece, index) => {
    let panelData: CadPanelGeometry;
    try {
      panelData = buildCadPanelGeometry(piece);
    } catch {
      // Keep invalid/open CAD contours out of the 3D panel preview.
      return;
    }
    const geometry = createCadPanelBufferGeometry(panelData);
    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox;
    if (!bounds) { geometry.dispose(); return; }
    const width = bounds.max.x - bounds.min.x;
    const depth = bounds.max.y - bounds.min.y;
    if (cursorX > 0 && cursorX + width > 145) { cursorX = 0; cursorZ += rowDepth + 8; rowDepth = 0; }
    const centerX = (bounds.min.x + bounds.max.x) / 2;
    const centerY = (bounds.min.y + bounds.max.y) / 2;
    geometry.translate(-centerX, -centerY, 0);

    const pieceGroup = new THREE.Group();
    pieceGroup.name = piece.nameAr || piece.name;
    pieceGroup.rotation.x = -Math.PI / 2;
    pieceGroup.position.set(cursorX + width / 2, 108, cursorZ + depth / 2);

    const material = new THREE.MeshStandardMaterial({
      color: piece.color || ['#60a5fa', '#f472b6', '#34d399', '#fbbf24'][index % 4],
      roughness: 0.78, metalness: 0.02, side: THREE.DoubleSide,
      transparent: true, opacity: 0.88
    });
    const panel = new THREE.Mesh(geometry, material);
    panel.name = piece.nameAr || piece.name;
    panel.userData.cadPanel = geometry.userData.cadPanel;
    panel.castShadow = true;
    panel.receiveShadow = true;
    pieceGroup.add(panel);

    const outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry, 25),
      new THREE.LineBasicMaterial({ color: '#0f172a', transparent: true, opacity: 0.8 })
    );
    outline.position.z = 0.025;
    pieceGroup.add(outline);

    const localPoint = (point: { x: number; y: number }, z = 0.04) =>
      new THREE.Vector3(point.x - centerX, point.y - centerY, z);
    const addLine = (points: THREE.Vector3[], color: string, dashed = false) => {
      if (points.length < 2) return;
      const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
      const lineMaterial = dashed
        ? new THREE.LineDashedMaterial({ color, dashSize: 1.2, gapSize: 0.65, transparent: true, opacity: 0.95 })
        : new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 });
      const line = new THREE.Line(lineGeometry, lineMaterial);
      if (dashed) line.computeLineDistances();
      pieceGroup.add(line);
    };

    // Preserve the CAD stitch layer (including darts) in the 3D flat-panel view.
    piece.segments.filter(segment => segment.layer === 'stitch').forEach(segment => {
      const p1 = localPoint(segment.p1, 0.045);
      const p2 = localPoint(segment.p2, 0.045);
      let points: THREE.Vector3[];
      if (segment.type === 'quad' && segment.cp1) {
        points = new THREE.QuadraticBezierCurve3(p1, localPoint(segment.cp1, 0.045), p2).getPoints(16);
      } else if (segment.type === 'bezier' && segment.cp1 && segment.cp2) {
        points = new THREE.CubicBezierCurve3(p1, localPoint(segment.cp1, 0.045), localPoint(segment.cp2, 0.045), p2).getPoints(20);
      } else {
        points = [p1, p2];
      }
      addLine(points, '#172554');
    });

    piece.grainlines.forEach(grainline => {
      addLine([localPoint(grainline.p1, 0.05), localPoint(grainline.p2, 0.05)], '#b45309', true);
    });

    piece.notches.forEach(notch => {
      const angle = notch.angleDeg * Math.PI / 180;
      const half = notch.depthCm / 2;
      addLine([
        localPoint({ x: notch.point.x - Math.cos(angle) * half, y: notch.point.y - Math.sin(angle) * half }, 0.06),
        localPoint({ x: notch.point.x + Math.cos(angle) * half, y: notch.point.y + Math.sin(angle) * half }, 0.06)
      ], '#be123c');
    });

    root.add(pieceGroup);
    cursorX += width + 8;
    rowDepth = Math.max(rowDepth, depth);
  });
  root.visible = false;
  return root;
}

interface Pattern3DViewerProps {
  state: AppState;
  fabricState: FabricCustomState;
  onOpenFabricDrawer?: () => void;
  onOpenMeasurementsDrawer?: () => void;
  isSplitView?: boolean;
  projectId?: string | null;
}

export function Pattern3DViewer({
  state,
  fabricState,
  onOpenFabricDrawer,
  onOpenMeasurementsDrawer,
  isSplitView = false,
  projectId = null
}: Pattern3DViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const [presentationMode, setPresentationMode] = useState<'atelier' | 'luxury'>('atelier');
  const [referenceLibraryOpen, setReferenceLibraryOpen] = useState(false);
  const [referencePreviewFile, setReferencePreviewFile] = useState<string | null>(null);
  const referencePreviewGroupRef = useRef<THREE.Group | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const annyGroupRef = useRef<THREE.Group | null>(null);
  const annyNativeHeightRef = useRef<number | null>(null);
  const annyBodyMeshRef = useRef<THREE.Mesh | null>(null);
  const annySourceGeometryRef = useRef<THREE.BufferGeometry | null>(null);
  const [annyCalibrationSummary, setAnnyCalibrationSummary] = useState<Omit<AnnyBodyCalibrationResult, 'geometry'> | null>(null);
  const annyFileInputRef = useRef<HTMLInputElement>(null);
  const garmentResultRef = useRef<Garment3DResult | null>(null);
  const cadPreviewGroupRef = useRef<THREE.Group | null>(null);
  const [showCadPieces, setShowCadPieces] = useState(false);
  const [cadPieceCount, setCadPieceCount] = useState(0);
  const [cadDocument, setCadDocument] = useState<CadProjectDocument | null>(null);
  const [cadSewingAudit, setCadSewingAudit] = useState<CadSewingAudit | null>(null);
  const [sewingPanelOpen, setSewingPanelOpen] = useState(false);
  const reqIdRef = useRef<number | null>(null);

  // Interaction & Camera Controls state
  const isDraggingRef = useRef(false);
  const isPanningRef = useRef(false);
  const prevMouseRef = useRef({ x: 0, y: 0 });
  const sphericalRef = useRef({ radius: 130, theta: Math.PI / 4, phi: Math.PI / 2.3 });
  const targetLookRef = useRef(new THREE.Vector3(0, 50, 0));
  const userMovedCameraRef = useRef(false);
  const fitRadiusRef = useRef(130);

  // Visual toggles
  const [annyPreviewEnabled, setAnnyPreviewEnabled] = useState(false);
  const annyAutoLoadStartedRef = useRef(false);
  // Garment geometry is drafted from the project's tape measurements; keep this
  // optional when previewing Anny because Anny phenotypes are not cm-calibrated.
  const [showGarmentOnAnny, setShowGarmentOnAnny] = useState(true);
  const [annyBundledBusy, setAnnyBundledBusy] = useState(false);
  const [annyApiUrl, setAnnyApiUrl] = useState(import.meta.env.VITE_ANNY_API_URL ?? '');
  const [annyApiPanelOpen, setAnnyApiPanelOpen] = useState(false);
  const [annyApiBusy, setAnnyApiBusy] = useState(false);
  const [annyApiMessage, setAnnyApiMessage] = useState('');
  const [annyProfileBusy, setAnnyProfileBusy] = useState(false);
  const [annyProfileMessage, setAnnyProfileMessage] = useState('');
  const [annyProfileCandidates, setAnnyProfileCandidates] = useState<AnnyCalibrationCandidate[]>([]);
  const [annyPhenotypeLabels, setAnnyPhenotypeLabels] = useState<string[]>([]);
  const [annyPhenotypes, setAnnyPhenotypes] = useState<Record<string, number>>({});
  const [annyApiConnected, setAnnyApiConnected] = useState(false);
  const [glbExportError, setGlbExportError] = useState('');
  const [showSeams, setShowSeams] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  // The renderer loop is created once; mirror React state into a ref so the
  // long-lived animation callback always sees the latest toggle value.
  const autoRotateRef = useRef(autoRotate);
  useEffect(() => { autoRotateRef.current = autoRotate; }, [autoRotate]);
  const [activeCameraView, setActiveCameraView] = useState<'perspective' | 'front' | 'back' | 'side' | 'top'>('perspective');

  const updateCameraPosition = useCallback(() => {
    if (!cameraRef.current) return;
    const { radius, theta, phi } = sphericalRef.current;
    const target = targetLookRef.current;

    const x = target.x + radius * Math.sin(phi) * Math.sin(theta);
    const y = target.y + radius * Math.cos(phi);
    const z = target.z + radius * Math.sin(phi) * Math.cos(theta);

    cameraRef.current.position.set(x, y, z);
    cameraRef.current.lookAt(target);
  }, []);

  /**
   * Frames the whole scene (mannequin + garment + stand) inside the viewport.
   * Keeps the model fully visible instead of showing a cropped close-up.
   */
  const frameScene = useCallback((force = false) => {
    if (force) userMovedCameraRef.current = false;
    if (userMovedCameraRef.current) return;

    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!scene || !camera) return;

    const box = new THREE.Box3();
    scene.children.forEach(child => {
      if (child.visible) box.expandByObject(child);
    });
    if (box.isEmpty()) return;

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    const vFov = (camera.fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    const distanceForHeight = (size.y / 2) / Math.tan(vFov / 2);
    const distanceForWidth = (Math.max(size.x, size.z) / 2) / Math.tan(hFov / 2);

    const radius = Math.max(distanceForHeight, distanceForWidth) * 1.18;

    targetLookRef.current.copy(center);
    fitRadiusRef.current = radius;
    sphericalRef.current.radius = Math.max(30, Math.min(400, radius));
    updateCameraPosition();
  }, [updateCameraPosition]);

  // Initialize Three.js Scene
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a); // Deep slate studio backdrop
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 1000);
    cameraRef.current = camera;
    updateCameraPosition();

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    rendererRef.current = renderer;

    container.replaceChildren(renderer.domElement);

    // Studio Lighting Rig
    const ambientLight = new THREE.HemisphereLight(0xffffff, 0x1e293b, 1.2);
    scene.add(ambientLight);

    // Key Light
    const keyLight = new THREE.DirectionalLight(0xfff6ed, 2.4);
    keyLight.position.set(60, 120, 80);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.camera.near = 10;
    keyLight.shadow.camera.far = 300;
    keyLight.shadow.camera.left = -60;
    keyLight.shadow.camera.right = 60;
    keyLight.shadow.camera.top = 100;
    keyLight.shadow.camera.bottom = -40;
    keyLight.name = 'studio-key-light';
    scene.add(keyLight);

    // Fill Light
    const fillLight = new THREE.DirectionalLight(0xdbeafe, 1.3);
    fillLight.position.set(-70, 80, -40);
    fillLight.name = 'studio-fill-light';
    scene.add(fillLight);

    // Rim / Back Light (creates elegant fashion studio edge highlight)
    const rimLight = new THREE.DirectionalLight(0xfef08a, 1.8);
    rimLight.position.set(0, 110, -90);
    rimLight.name = 'studio-rim-light';
    scene.add(rimLight);

    // Studio Circular Podium Floor
    const floorGeom = new THREE.CylinderGeometry(55, 58, 2, 64);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.7,
      metalness: 0.1
    });
    const floor = new THREE.Mesh(floorGeom, floorMat);
    floor.position.set(0, -1, 0);
    floor.receiveShadow = true;
    floor.name = 'studio-podium';
    scene.add(floor);

    // Circular Gold Trim on Podium
    const trimGeom = new THREE.TorusGeometry(58.2, 0.4, 16, 64);
    trimGeom.rotateX(Math.PI / 2);
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.8,
      roughness: 0.25
    });
    const trim = new THREE.Mesh(trimGeom, trimMat);
    trim.position.set(0, 0, 0);
    scene.add(trim);

    // Soft Shadow Contact Ground Plane
    const shadowPlaneGeom = new THREE.PlaneGeometry(300, 300);
    shadowPlaneGeom.rotateX(-Math.PI / 2);
    const shadowPlaneMat = new THREE.ShadowMaterial({ opacity: 0.4 });
    const shadowPlane = new THREE.Mesh(shadowPlaneGeom, shadowPlaneMat);
    shadowPlane.position.set(0, -2, 0);
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);

    // Resize Observer
    const ro = new ResizeObserver(() => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      frameScene();
    });      ro.observe(container);

    // Animation Loop
    const animate = () => {
      reqIdRef.current = requestAnimationFrame(animate);

      if (autoRotateRef.current) {
        sphericalRef.current.theta += 0.008;
        updateCameraPosition();
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      if (reqIdRef.current) cancelAnimationFrame(reqIdRef.current);
      ro.disconnect();
      disposeObjectResources(scene);
      scene.clear();
      renderer.dispose();
      renderer.domElement.remove();
      if (sceneRef.current === scene) sceneRef.current = null;
      if (rendererRef.current === renderer) rendererRef.current = null;
      if (cameraRef.current === camera) cameraRef.current = null;
      reqIdRef.current = null;
    };
  }, []);

  // Switch between technical atelier lighting and a warm luxury product-showcase look.
  // This changes presentation only; it never alters garment or body geometry.
  useEffect(() => {
    const scene = sceneRef.current;
    const renderer = rendererRef.current;
    if (!scene || !renderer) return;

    const luxury = presentationMode === 'luxury';
    scene.background = new THREE.Color(luxury ? 0xe8dfd1 : 0x0f172a);
    renderer.toneMappingExposure = luxury ? 1.28 : 1.15;

    const key = scene.getObjectByName('studio-key-light') as THREE.DirectionalLight | undefined;
    const fill = scene.getObjectByName('studio-fill-light') as THREE.DirectionalLight | undefined;
    const rim = scene.getObjectByName('studio-rim-light') as THREE.DirectionalLight | undefined;
    if (key) { key.intensity = luxury ? 2.8 : 2.4; key.color.set(luxury ? 0xffe4c4 : 0xfff6ed); }
    if (fill) { fill.intensity = luxury ? 1.05 : 1.3; fill.color.set(luxury ? 0xffead6 : 0xdbeafe); }
    if (rim) { rim.intensity = luxury ? 2.1 : 1.8; rim.color.set(luxury ? 0xffd58a : 0xfef08a); }

    const podium = scene.getObjectByName('studio-podium') as THREE.Mesh | undefined;
    const podiumMaterial = podium?.material as THREE.MeshStandardMaterial | undefined;
    if (podiumMaterial?.color) podiumMaterial.color.set(luxury ? 0x57483d : 0x1e293b);
  }, [presentationMode]);

  // Generate the garment's main body surface from Anny's real mesh sections.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Anny is the sole body model. Resolve measurements for garment geometry.
    const meas = { ...(state.measurementProfile?.values ?? {}), ...state.customMeasurements };
    const resolvedMeasurements = resolve3DMeasurements(state.gender, state.size, meas);
    const currentMeasurements = resolvedMeasurements.body;

    // Remove the previous garment before rebuilding it from the current Anny mesh.
    if (garmentResultRef.current) {
      scene.remove(garmentResultRef.current.group);
      disposeObjectResources(garmentResultRef.current.group);
      garmentResultRef.current = null;
    }
    if (!annyPreviewEnabled || !annyBodyMeshRef.current) {
      return;
    }

    let annyBodyProfile;
    try {
      annyGroupRef.current?.updateMatrixWorld(true);
      annyBodyProfile = buildAnnyBodyProfile(annyBodyMeshRef.current, {
        landmarks: (annyCalibrationSummary?.landmarks ?? []).map(item => ({
          zone: item.zone,
          heightFraction: item.heightFraction
        }))
      });

    } catch (error) {
      console.error('Unable to extract Anny body profile', error);
      return;
    }

    const fabricMat = createFabricThreeMaterial(fabricState);

    const garmentResult = generate3DGarmentMesh(
      {
        garmentType: state.garment,
        gender: state.gender,
        bust: currentMeasurements.bust,
        waist: currentMeasurements.waist,
        hip: currentMeasurements.hip,
        shoulder: currentMeasurements.shoulder,
        backLength: currentMeasurements.backLength,
        height: currentMeasurements.height,
        sleeveLength: resolvedMeasurements.sleeveLength,
        totalLength: resolvedMeasurements.totalLength,
        fabricState,
        showHeatmap,
        annyBodyProfile
      },
      fabricMat
    );

    // Keep the designed wearing ease, correcting only true body intersections.
    // Apply this to torso, sleeves and trouser legs, not just the torso shell.
    annyBodyMeshRef.current.updateWorldMatrix(true, false);
    garmentResult.group.updateWorldMatrix(true, true);
    const fitReport = conformGarmentGroupToBody(garmentResult.group, annyBodyMeshRef.current, 0.6);
    if (fitReport.status === 'partial') {
      console.warn('Garment fit correction was partial; inspect garment/body intersections.', fitReport);
    }

    garmentResult.seamLinesGroup.visible = showSeams;
    garmentResult.group.visible = showGarmentOnAnny;
    scene.add(garmentResult.group);
    garmentResultRef.current = garmentResult;

    // Re-frame only while the user has not taken control of the camera.
    frameScene();
  }, [state.gender, state.size, state.garment, state.customMeasurements, state.measurementProfile, fabricState, showHeatmap, showSeams, annyPreviewEnabled, annyCalibrationSummary, showGarmentOnAnny, frameScene]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const refreshCadDocument = () => {
      if (cadPreviewGroupRef.current) {
        scene.remove(cadPreviewGroupRef.current);
        disposeObjectResources(cadPreviewGroupRef.current);
        cadPreviewGroupRef.current = null;
      }
      setCadPieceCount(0);
      setShowCadPieces(false);
      setCadDocument(null);
      setCadSewingAudit(null);
      if (!projectId || typeof window === 'undefined') return;

      const document = loadCadProjectDocument(window.localStorage, projectId);
      if (!document?.pieces.length) return;
      const preview = buildCadPiecePreview(document.pieces);
      preview.visible = false;
      scene.add(preview);
      cadPreviewGroupRef.current = preview;
      setCadPieceCount(preview.children.length);
      setCadDocument(document);
      setCadSewingAudit(auditCadSewing(document.pieces, document.stitchPairs));
    };

    refreshCadDocument();
    if (typeof window === 'undefined') return;
    const handleCadDocumentChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ projectId?: string }>).detail;
      if (detail?.projectId === projectId) refreshCadDocument();
    };
    window.addEventListener('patron-studio:cad-document-updated', handleCadDocumentChanged);
    return () => window.removeEventListener('patron-studio:cad-document-updated', handleCadDocumentChanged);
  }, [projectId]);

  const acceptCadSeamSuggestion = (suggestion: CadSeamSuggestion, mode: 'plain' | 'ease' | 'gather') => {
    if (!projectId || !cadDocument || typeof window === 'undefined') return;
    const pair = createCadStitchPairFromSuggestion(suggestion, mode);
    const stitchPairs = [...cadDocument.stitchPairs, pair];
    const updatedAt = new Date().toISOString();
    const saved = saveCadProjectDocument(
      window.localStorage, projectId, cadDocument.pieces, cadDocument.summaries, updatedAt, stitchPairs
    );
    if (!saved) return;
    const updatedDocument = { ...cadDocument, updatedAt, stitchPairs };
    setCadDocument(updatedDocument);
    setCadSewingAudit(auditCadSewing(updatedDocument.pieces, stitchPairs));
  };

  const removeCadStitchPair = (pairId: string) => {
    if (!projectId || !cadDocument || typeof window === 'undefined') return;
    const stitchPairs = cadDocument.stitchPairs.filter(pair => pair.id !== pairId);
    const updatedAt = new Date().toISOString();
    const saved = saveCadProjectDocument(
      window.localStorage, projectId, cadDocument.pieces, cadDocument.summaries, updatedAt, stitchPairs
    );
    if (!saved) return;
    const updatedDocument = { ...cadDocument, updatedAt, stitchPairs };
    setCadDocument(updatedDocument);
    setCadSewingAudit(auditCadSewing(updatedDocument.pieces, stitchPairs));
  };

  useEffect(() => {
    if (cadPreviewGroupRef.current) cadPreviewGroupRef.current.visible = showCadPieces;
  }, [showCadPieces, cadPieceCount]);

  // Handle Mouse / Touch Orbit Controls
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    userMovedCameraRef.current = true;
    isPanningRef.current = e.button === 2 || e.shiftKey;
    prevMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - prevMouseRef.current.x;
    const dy = e.clientY - prevMouseRef.current.y;
    prevMouseRef.current = { x: e.clientX, y: e.clientY };

    if (isPanningRef.current) {
      // Pan target
      targetLookRef.current.y += dy * 0.15;
    } else {
      // Orbit
      sphericalRef.current.theta -= dx * 0.009;
      sphericalRef.current.phi = Math.max(0.1, Math.min(Math.PI - 0.1, sphericalRef.current.phi - dy * 0.009));
    }
    updateCameraPosition();
  };

  // Touch Handlers for mobile phones & tablets
  const prevPinchDistRef = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    userMovedCameraRef.current = true;
    if (e.touches.length === 1) {
      isDraggingRef.current = true;
      isPanningRef.current = false;
      prevMouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      isDraggingRef.current = false;
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      prevPinchDistRef.current = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDraggingRef.current) {
      const dx = e.touches[0].clientX - prevMouseRef.current.x;
      const dy = e.touches[0].clientY - prevMouseRef.current.y;
      prevMouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };

      sphericalRef.current.theta -= dx * 0.012;
      sphericalRef.current.phi = Math.max(0.1, Math.min(Math.PI - 0.1, sphericalRef.current.phi - dy * 0.012));
      updateCameraPosition();
    } else if (e.touches.length === 2 && prevPinchDistRef.current !== null) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const delta = prevPinchDistRef.current - dist;
      prevPinchDistRef.current = dist;

      sphericalRef.current.radius = clampRadius(sphericalRef.current.radius + delta * 0.5);
      updateCameraPosition();
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    isPanningRef.current = false;
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
    prevPinchDistRef.current = null;
  };

  const clampRadius = (r: number) =>
    Math.max(fitRadiusRef.current * 0.25, Math.min(fitRadiusRef.current * 2.2, r));

  const handleWheel = (e: React.WheelEvent) => {
    userMovedCameraRef.current = true;
    sphericalRef.current.radius = clampRadius(sphericalRef.current.radius + e.deltaY * 0.1);
    updateCameraPosition();
  };

  // Camera presets
  const setCameraPreset = (view: 'perspective' | 'front' | 'back' | 'side' | 'top') => {
    setActiveCameraView(view);
    setAutoRotate(false);
    userMovedCameraRef.current = true;
    targetLookRef.current.set(0, 50, 0);

    const r = fitRadiusRef.current;
    if (view === 'front') {
      sphericalRef.current = { radius: r, theta: 0, phi: Math.PI / 2 };
    } else if (view === 'back') {
      sphericalRef.current = { radius: r, theta: Math.PI, phi: Math.PI / 2 };
    } else if (view === 'side') {
      sphericalRef.current = { radius: r, theta: Math.PI / 2, phi: Math.PI / 2 };
    } else if (view === 'top') {
      sphericalRef.current = { radius: r * 1.05, theta: 0, phi: 0.1 };
    } else {
      // Perspective
      sphericalRef.current = { radius: r, theta: Math.PI / 4, phi: Math.PI / 2.3 };
    }
    updateCameraPosition();
  };

  // Install a generated or locally selected Anny mesh in the existing Three.js scene.
  // Display scaling only normalizes the preview height; it is not measurement calibration.
  const installAnnyScene = (bodyScene: THREE.Object3D) => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (referencePreviewGroupRef.current) {
      scene.remove(referencePreviewGroupRef.current);
      disposeObjectResources(referencePreviewGroupRef.current);
      referencePreviewGroupRef.current = null;
      setReferencePreviewFile(null);
    }
    if (annyGroupRef.current) {
      scene.remove(annyGroupRef.current);
      disposeObjectResources(annyGroupRef.current);
      annyGroupRef.current = null;
    }
    const group = new THREE.Group();
    group.name = 'AnnyBodyPreview';
    bodyScene.updateMatrixWorld(true);
    const bodyMeshes: THREE.Mesh[] = [];
    bodyScene.traverse(object => {
      if (object instanceof THREE.Mesh) bodyMeshes.push(object);
    });
    if (annySourceGeometryRef.current) {
      annySourceGeometryRef.current.dispose();
      annySourceGeometryRef.current = null;
    }
    annyBodyMeshRef.current = null;
    setAnnyCalibrationSummary(null);
    // The bundled Anny export is a single, static triangle mesh. Keep a clean
    // source copy so every measurement edit recalibrates from the original,
    // never cumulatively deforming an already deformed body.
    if (bodyMeshes.length === 1 && !(bodyMeshes[0] instanceof THREE.SkinnedMesh)) {
      const bodyMesh = bodyMeshes[0];
      const sourceGeometry = bodyMesh.geometry.clone().applyMatrix4(bodyMesh.matrix);
      bodyMesh.position.set(0, 0, 0);
      bodyMesh.rotation.set(0, 0, 0);
      bodyMesh.scale.set(1, 1, 1);
      bodyMesh.updateMatrix();
      annySourceGeometryRef.current = sourceGeometry;
      annyBodyMeshRef.current = bodyMesh;
    } else {
      setAnnyCalibrationSummary({
        nativeHeight: 0, targetHeightCm: 0, heightScale: 1, landmarks: [],
        status: 'review-required',
        warnings: ['هذا الملف لا يحتوي على شبكة Anny ثابتة واحدة؛ تم عرض الجسم دون معايرة محيطية آلية.']
      });
    }
    group.add(bodyScene);
    // Anny's native mesh is Z-up. Convert it to this viewer's Y-up world.
    group.rotation.x = -Math.PI / 2;
    const bounds = new THREE.Box3().setFromObject(group);
    const size = bounds.getSize(new THREE.Vector3());
    if (!Number.isFinite(size.y) || size.y <= 0) {
      disposeObjectResources(group);
      throw new Error('ملف Anny لا يحتوي على مجسم صالح.');
    }
    annyNativeHeightRef.current = size.y;
    const measurementValues = { ...(state.measurementProfile?.values ?? {}), ...state.customMeasurements };
    const resolved = resolve3DMeasurements(state.gender, state.size, measurementValues);
    const targetHeightCm = resolveAnnyTargetHeightCm(state.gender, resolved.body.height);
    if (annyBodyMeshRef.current && annySourceGeometryRef.current) {
      try {
        const calibration = calibrateAnnyBodyGeometry(annySourceGeometryRef.current, {
          heightCm: targetHeightCm,
          bustCm: resolved.body.bust,
          waistCm: resolved.body.waist,
          hipCm: resolved.body.hip
        });
        const previousGeometry = annyBodyMeshRef.current.geometry;
        annyBodyMeshRef.current.geometry = calibration.geometry;
        previousGeometry.dispose();
        const { geometry: _geometry, ...summary } = calibration;
        setAnnyCalibrationSummary(summary);
      } catch (error) {
        setAnnyCalibrationSummary({
          nativeHeight: size.y, targetHeightCm, heightScale: getAnnyHeightScale(size.y, targetHeightCm),
          landmarks: [], status: 'review-required',
          warnings: [error instanceof Error ? error.message : 'تعذر معايرة جسم Anny؛ تم تحميله دون تغيير محيطي.']
        });
      }
    }
    group.scale.setScalar(getAnnyHeightScale(size.y, targetHeightCm));
    const scaledBounds = new THREE.Box3().setFromObject(group);
    const center = scaledBounds.getCenter(new THREE.Vector3());
    group.position.set(-center.x, -scaledBounds.min.y, -center.z);
    group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    scene.add(group);
    annyGroupRef.current = group;
    setAnnyPreviewEnabled(true);
    requestAnimationFrame(() => frameScene(true));
  };

  // Keep Anny's full-body stature synchronized with the active measurement profile.
  // Reposition the group after scaling so its feet remain on the floor.
  useEffect(() => {
    const group = annyGroupRef.current;
    const nativeHeight = annyNativeHeightRef.current;
    if (!group || !nativeHeight || !annyPreviewEnabled) return;

    const measurementValues = { ...(state.measurementProfile?.values ?? {}), ...state.customMeasurements };
    const resolved = resolve3DMeasurements(state.gender, state.size, measurementValues);
    const targetHeightCm = resolveAnnyTargetHeightCm(state.gender, resolved.body.height);
    if (annyBodyMeshRef.current && annySourceGeometryRef.current) {
      try {
        const calibration = calibrateAnnyBodyGeometry(annySourceGeometryRef.current, {
          heightCm: targetHeightCm,
          bustCm: resolved.body.bust,
          waistCm: resolved.body.waist,
          hipCm: resolved.body.hip
        });
        const previousGeometry = annyBodyMeshRef.current.geometry;
        annyBodyMeshRef.current.geometry = calibration.geometry;
        previousGeometry.dispose();
        const { geometry: _geometry, ...summary } = calibration;
        setAnnyCalibrationSummary(summary);
      } catch (error) {
        setAnnyCalibrationSummary({
          nativeHeight, targetHeightCm, heightScale: getAnnyHeightScale(nativeHeight, targetHeightCm),
          landmarks: [], status: 'review-required',
          warnings: [error instanceof Error ? error.message : 'تعذر معايرة شبكة Anny؛ عُرض النموذج دون تغيير محيطي.']
        });
      }
    }
    group.position.set(0, 0, 0);
    group.scale.setScalar(getAnnyHeightScale(nativeHeight, targetHeightCm));
    group.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(group);
    const center = bounds.getCenter(new THREE.Vector3());
    group.position.set(-center.x, -bounds.min.y, -center.z);
    group.updateMatrixWorld(true);
    frameScene();
  }, [state.gender, state.size, state.customMeasurements, state.measurementProfile, annyPreviewEnabled, frameScene]);

  const handleLoadBundledAnny = async () => {
    setAnnyBundledBusy(true);

    try {
      const modelUrl = `${import.meta.env.BASE_URL}models/anny-neutral.glb`;
      const response = await fetch(modelUrl, { cache: 'no-cache' });
      if (!response.ok) {
        throw new Error('لم يُنشر نموذج Anny الأساسي بعد. أعد المحاولة بعد اكتمال نشر الموقع.');
      }
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength < 1000) throw new Error('ملف Anny الأساسي غير مكتمل.');
      const gltf = await new GLTFLoader().parseAsync(buffer, '');
      installAnnyScene(gltf.scene);

    } catch (error) {
      console.error('Unable to load the bundled Anny base model', error);
    } finally {
      setAnnyBundledBusy(false);
    }
  };

  // Anny is the default visual body. The procedural mannequin remains available
  // as a local fallback until Anny's mesh has validated tape-measure calibration.
  useEffect(() => {
    if (annyAutoLoadStartedRef.current) return;
    annyAutoLoadStartedRef.current = true;
    void handleLoadBundledAnny();
    // Load once after the renderer scene has been initialized.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getAnnyApiBaseUrl = () => annyApiUrl.trim().replace(/\/+$/, '');

  const readAnnyApiError = async (response: Response) => {
    const payload = await response.json().catch(() => null) as { detail?: unknown } | null;
    return typeof payload?.detail === 'string' ? payload.detail : `HTTP ${response.status}: تعذر تنفيذ طلب Anny.`;
  };

  const handleConnectAnnyApi = async () => {
    const baseUrl = getAnnyApiBaseUrl();
    if (!baseUrl) {
      setAnnyApiMessage('أدخل عنوان خدمة Anny أولاً.');
      return;
    }
    setAnnyApiBusy(true);
    setAnnyApiMessage('جارٍ الاتصال بخدمة Anny وتحميل معاملات النموذج...');
    try {
      const response = await fetch(`${baseUrl}/v1/anny/phenotypes`);
      if (!response.ok) throw new Error(await readAnnyApiError(response));
      const payload = await response.json() as { labels?: unknown; measurement_status?: string };
      if (!Array.isArray(payload.labels) || !payload.labels.every(label => typeof label === 'string')) {
        throw new Error('استجابة خدمة Anny لا تحتوي قائمة معاملات صالحة.');
      }
      const labels = payload.labels as string[];
      if (!labels.length) throw new Error('لم يُرجع النموذج أي معاملات شكل.');
      setAnnyPhenotypeLabels(labels);
      setAnnyPhenotypes(Object.fromEntries(labels.map(label => [label, 0.5])));
      setAnnyApiConnected(true);
      setAnnyApiMessage(`تم الاتصال. تم تحميل ${labels.length} معاملاً حقيقياً من النموذج. القيم الحالية افتراضية وليست قياسات خياطة.`);
    } catch (error) {
      setAnnyApiConnected(false);
      setAnnyApiMessage(error instanceof Error ? error.message : 'تعذر الاتصال بخدمة Anny.');
    } finally {
      setAnnyApiBusy(false);
    }
  };

  const handleAnalyzeAnnyProfile = async () => {
    const baseUrl = getAnnyApiBaseUrl();
    if (!baseUrl || !annyApiConnected) {
      setAnnyProfileMessage('اتصل بخدمة Anny وحمّل معاملات النموذج أولاً.');
      return;
    }
    setAnnyProfileBusy(true);
    setAnnyProfileMessage('جارٍ توليد الجسم وتحليل 121 مقطعاً أفقياً. قد تستغرق العملية عدة دقائق على CPU...');
    setAnnyProfileCandidates([]);
    try {
      const response = await fetch(baseUrl + '/v1/anny/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phenotypes: Object.fromEntries(
            Object.entries(annyPhenotypes).filter(([, value]) => Math.abs(value - 0.5) > 1e-9)
          )
        })
      });
      if (!response.ok) throw new Error(await readAnnyApiError(response));
      const report = await response.json() as AnnyProfileReport;
      const targetHeightCm = resolveAnnyTargetHeightCm(state.gender, state.customMeasurements.height);
      const tape = state.measurementProfile?.values;
      const targets = tape ? { hip: tape.hip, waist: tape.waist, bust: tape.bust } : {};
      const candidates = buildAnnyCalibrationCandidates(report, targetHeightCm, targets);
      setAnnyProfileCandidates(candidates);
      setAnnyProfileMessage(
        candidates.length
          ? 'اكتمل التحليل. هذه مرشحات هندسية أولية فقط؛ راجع مواضعها على الجسم قبل استخدامها.'
          : 'اكتمل التحليل، لكن لم ينتج مرشحات صالحة للمراجعة.'
      );
    } catch (error) {
      setAnnyProfileMessage(error instanceof Error ? error.message : 'تعذر تحليل مقاطع جسم Anny.');
    } finally {
      setAnnyProfileBusy(false);
    }
  };

  const handleGenerateAnnyFromApi = async () => {
    const baseUrl = getAnnyApiBaseUrl();
    if (!baseUrl || !annyApiConnected) {
      setAnnyApiMessage('اتصل بخدمة Anny وحمّل قائمة المعاملات أولاً.');
      return;
    }
    setAnnyApiBusy(true);
    setAnnyApiMessage('جارٍ توليد الجسم باستخدام Anny. قد يستغرق التشغيل الأول وقتاً أطول...');
    try {
      const response = await fetch(`${baseUrl}/v1/anny/generate/glb`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phenotypes: Object.fromEntries(Object.entries(annyPhenotypes).filter(([, value]) => Math.abs(value - 0.5) > 1e-9)) })
      });
      if (!response.ok) throw new Error(await readAnnyApiError(response));
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength < 20) throw new Error('استجابة GLB فارغة أو غير مكتملة.');
      const gltf = await new GLTFLoader().parseAsync(buffer, '');
      installAnnyScene(gltf.scene);
      setAnnyApiMessage('اكتمل التوليد وعُرض جسم Anny في المشهد. لا تزال القياسات غير معايرة.');
    } catch (error) {
      setAnnyApiMessage(error instanceof Error ? error.message : 'فشل توليد جسم Anny.');
    } finally {
      setAnnyApiBusy(false);
    }
  };

  // Load a locally generated Anny GLB as a body-only reference preview.
  // Height normalization is visual only; it does not calibrate measurements.
  const handleAnnyFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    const loader = new GLTFLoader();
    loader.load(objectUrl, (gltf) => {
      URL.revokeObjectURL(objectUrl);
      try {
        installAnnyScene(gltf.scene);

      } catch (error) {
        console.error('The selected GLB does not contain a valid Anny body mesh', error);
      }
    }, undefined, () => {
      URL.revokeObjectURL(objectUrl);
      console.error('Unable to open the selected Anny GLB file');
    });
    event.target.value = '';
  };

  // Load an existing repository GLB as a neutral visual reference.
  // It is intentionally not treated as an Anny body and is not used for tape calibration.
  const handlePreviewReferenceModel = (file: string, label: string) => {
    const scene = sceneRef.current;
    if (!scene) return;
    const url = `https://raw.githubusercontent.com/loay94an/3d-patrons-./main/${file.split('/').map(encodeURIComponent).join('/')}`;
    const loader = new GLTFLoader();
    setGlbExportError('');
    loader.load(url, (gltf) => {
      try {
        if (referencePreviewGroupRef.current) {
          scene.remove(referencePreviewGroupRef.current);
          disposeObjectResources(referencePreviewGroupRef.current);
        }
        const group = new THREE.Group();
        group.name = `reference-model-${label}`;
        group.add(gltf.scene);
        group.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(group);
        const size = bounds.getSize(new THREE.Vector3());
        if (![size.x, size.y, size.z].every(Number.isFinite) || size.y <= 0) {
          disposeObjectResources(group);
          throw new Error('ملف GLB لا يحتوي على أبعاد صالحة للعرض.');
        }
        const scale = 165 / size.y;
        group.scale.setScalar(scale);
        group.updateMatrixWorld(true);
        const scaledBounds = new THREE.Box3().setFromObject(group);
        const center = scaledBounds.getCenter(new THREE.Vector3());
        group.position.set(-center.x, -scaledBounds.min.y, -center.z);
        group.traverse(object => {
          if (object instanceof THREE.Mesh) {
            object.castShadow = true;
            object.receiveShadow = true;
          }
        });
        setAnnyPreviewEnabled(false);
        if (annyGroupRef.current) annyGroupRef.current.visible = false;
        if (garmentResultRef.current) garmentResultRef.current.group.visible = false;
        scene.add(group);
        referencePreviewGroupRef.current = group;
        setReferencePreviewFile(file);
        setReferenceLibraryOpen(false);
        requestAnimationFrame(() => frameScene(true));
      } catch (error) {
        setGlbExportError(error instanceof Error ? error.message : 'تعذر عرض النموذج المرجعي.');
      }
    }, undefined, error => {
      console.error('Unable to load reference GLB', error);
      setGlbExportError('تعذر تحميل ملف GLB المرجعي. تحقق من اتصال الإنترنت أو صلاحية الملف.');
    });
  };

  const handleRestoreAnnyPreview = () => {
    const scene = sceneRef.current;
    if (referencePreviewGroupRef.current && scene) {
      scene.remove(referencePreviewGroupRef.current);
      disposeObjectResources(referencePreviewGroupRef.current);
      referencePreviewGroupRef.current = null;
    }
    setReferencePreviewFile(null);
    setAnnyPreviewEnabled(true);
    if (annyGroupRef.current) annyGroupRef.current.visible = true;
    if (garmentResultRef.current) garmentResultRef.current.group.visible = showGarmentOnAnny;
    requestAnimationFrame(() => frameScene(true));
  };

  // Export Snapshot PNG
  const handleSnapshot = () => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
    rendererRef.current.render(sceneRef.current, cameraRef.current);
    const dataUrl = rendererRef.current.domElement.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `fashion_3d_${state.gender}_${state.garment}.png`;
    link.href = dataUrl;
    link.click();
  };

  // Export the generated garment as a self-contained GLB with supported materials.
  const handleExportGlb = async () => {
    const garment = garmentResultRef.current;
    if (!garment) return;
    setGlbExportError('');
    try {
      const exporter = new GLTFExporter();
      const result = await exporter.parseAsync(garment.group, { binary: true, onlyVisible: true, trs: true });
      if (!(result instanceof ArrayBuffer)) throw new Error('لم يُنتج المُصدّر ملف GLB ثنائياً.');
      const blob = new Blob([result], { type: 'model/gltf-binary' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'garment_' + state.gender + '_' + state.garment + '.glb';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setGlbExportError(error instanceof Error ? error.message : 'تعذر تصدير GLB.');
    }
  };
  // Export the currently visible body and garment (or Anny preview) as one GLB scene.
  const handleExportSceneGlb = async () => {
    const exportObjects: THREE.Object3D[] = [];
    if (annyGroupRef.current) {
      exportObjects.push(annyGroupRef.current);
      if (showGarmentOnAnny && garmentResultRef.current?.group.visible) {
        exportObjects.push(garmentResultRef.current.group);
      }
    } else {
      if (garmentResultRef.current?.group.visible) exportObjects.push(garmentResultRef.current.group);
      if (cadPreviewGroupRef.current?.visible) exportObjects.push(cadPreviewGroupRef.current);
    }
    if (!exportObjects.length) {
      setGlbExportError('لا توجد عناصر ثلاثية الأبعاد ظاهرة للتصدير.');
      return;
    }
    setGlbExportError('');
    try {
      const exporter = new GLTFExporter();
      const result = await exporter.parseAsync(exportObjects, { binary: true, onlyVisible: true, trs: true });
      if (!(result instanceof ArrayBuffer)) throw new Error('لم يُنتج المُصدّر ملف GLB ثنائياً.');
      const blob = new Blob([result], { type: 'model/gltf-binary' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'fashion_scene_' + state.gender + '_' + state.garment + '.glb';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setGlbExportError(error instanceof Error ? error.message : 'تعذر تصدير المشهد بصيغة GLB.');
    }
  };
  // Export 3D OBJ
  const handleExportObj = () => {
    if (!garmentResultRef.current) return;
    const objStr = garmentResultRef.current.exportObj();
    const blob = new Blob([objStr], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `garment_${state.gender}_${state.garment}.obj`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const currentFabricPreset = FABRIC_PRESETS.find(f => f.id === fabricState.presetId) || FABRIC_PRESETS[0];

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-950 overflow-hidden select-none">
      {/* 3D Viewport Header Bar */}
      <div className="absolute top-2 left-2 right-2 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left Side: Garment & Fabric Info Badge */}
        <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto bg-slate-900/90 backdrop-blur-md px-2.5 sm:px-3.5 py-1.5 rounded-xl border border-slate-700/60 shadow-xl text-white text-xs">
          <span className="w-3.5 h-3.5 rounded-full border border-white/40 shadow-inner shrink-0" style={{ backgroundColor: fabricState.color }} />
          <div className="flex flex-col text-right">
            <span className="text-[11px] sm:text-xs font-bold leading-tight truncate max-w-[110px] sm:max-w-none">{currentFabricPreset.nameAr}</span>
            <span className="text-[9px] sm:text-[10px] text-slate-400">
              {state.gender === 'women' ? 'نساء' : state.gender === 'men' ? 'رجال' : 'أطفال'} • {state.size}
            </span>
          </div>

          <div className="h-4 w-px bg-slate-700 mx-0.5" />

          {/* Quick buttons */}
          {onOpenFabricDrawer && (
            <button
              onClick={onOpenFabricDrawer}
              className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/40 transition-colors"
            >
              القماش
            </button>
          )}

          {onOpenMeasurementsDrawer && (
            <button
              onClick={onOpenMeasurementsDrawer}
              className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 transition-colors"
            >
              المقاس
            </button>
          )}

          <button
            onClick={() => setReferenceLibraryOpen(true)}
            className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-emerald-600/25 hover:bg-emerald-600/45 text-emerald-200 border border-emerald-500/40 transition-colors whitespace-nowrap"
          >
            مكتبة النماذج
          </button>
          {referencePreviewFile && (
            <button
              onClick={handleRestoreAnnyPreview}
              className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-amber-600/25 hover:bg-amber-600/45 text-amber-200 border border-amber-500/40 transition-colors whitespace-nowrap"
            >
              العودة إلى Anny
            </button>
          )}

          <a
            href={`${import.meta.env.BASE_URL}assets/engines/anny-source.zip`}
            download="anny-source.zip"
            className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-200 border border-cyan-500/40 transition-colors whitespace-nowrap"
            title="تنزيل مصدر محرك Anny الرسمي"
          >
            ملفات Anny
          </a>
        </div>

        {/* Right Side: Camera View Angle Buttons */}
        <div className="flex items-center gap-1 pointer-events-auto bg-slate-900/90 backdrop-blur-md p-1 rounded-xl border border-slate-700/60 shadow-xl overflow-x-auto">
          {(['perspective', 'front', 'back', 'side'] as const).map(view => {
            const labels: Record<string, string> = { perspective: 'منظور', front: 'أمام', back: 'خلف', side: 'جانب' };
            return (
              <button
                key={view}
                onClick={() => setCameraPreset(view)}
                className={`px-2 py-0.5 rounded-lg text-[10px] sm:text-xs font-medium transition-colors whitespace-nowrap ${
                  activeCameraView === view ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                {labels[view]}
              </button>
            );
          })}
        </div>
      </div>

      {glbExportError && <div role="status" className="absolute top-16 left-3 right-3 z-20 rounded-lg border border-rose-500/40 bg-rose-950/90 px-3 py-2 text-xs text-rose-100">{glbExportError}</div>}

      {referenceLibraryOpen && (
        <ReferenceModelLibrary
          onClose={() => setReferenceLibraryOpen(false)}
          onPreviewLocal={handlePreviewReferenceModel}
          previewingFile={referencePreviewFile}
        />
      )}

      {/* Main 3D Canvas */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
        style={{ touchAction: 'none' }}
        className="w-full h-full cursor-grab active:cursor-grabbing select-none"
      />

      <input ref={annyFileInputRef} type="file" accept=".glb,model/gltf-binary" className="hidden" onChange={handleAnnyFileChange} aria-label="تحميل مجسم Anny بصيغة GLB" />

      {annyApiPanelOpen && <section className="absolute top-16 right-3 z-30 w-[min(25rem,calc(100vw-1.5rem))] max-h-[68vh] overflow-y-auto rounded-2xl border border-cyan-500/40 bg-slate-950/95 p-3 text-right text-xs text-white shadow-2xl backdrop-blur-md" dir="rtl">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="font-bold text-sm text-cyan-200">ربط نموذج Anny مباشرة</div>
            <div className="text-[10px] text-slate-400 mt-1">خدمة Python منفصلة عن استضافة GitHub Pages</div>
          </div>
          <button onClick={() => setAnnyApiPanelOpen(false)} className="rounded-lg px-2 py-1 bg-slate-800 text-slate-300">إغلاق</button>
        </div>
        <label className="block mt-3 mb-1 text-slate-300">عنوان خدمة Anny API</label>
        <input value={annyApiUrl} onChange={event => { setAnnyApiUrl(event.target.value); setAnnyApiConnected(false); }} placeholder="https://your-anny-api.example" className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-left text-xs text-white" dir="ltr" />
        <div className="flex gap-2 mt-2">
          <button disabled={annyApiBusy} onClick={() => void handleConnectAnnyApi()} className="flex-1 rounded-lg bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 px-3 py-2 font-bold">اتصال وتحميل المعاملات</button>
          <button disabled={annyApiBusy || !annyApiConnected} onClick={() => void handleGenerateAnnyFromApi()} className="flex-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-3 py-2 font-bold">توليد الجسم وعرضه</button>
          <button disabled={annyApiBusy || annyProfileBusy || !annyApiConnected} onClick={() => void handleAnalyzeAnnyProfile()} className="flex-1 rounded-lg bg-amber-700 hover:bg-amber-600 disabled:opacity-50 px-3 py-2 font-bold">تحليل المقاطع</button>
        </div>
        {annyApiMessage && <div role="status" className="mt-2 rounded-lg bg-slate-900 border border-slate-700 p-2 leading-5 text-slate-300">{annyApiMessage}</div>}
        {annyProfileMessage && <div role="status" className="mt-2 rounded-lg border border-amber-700/50 bg-amber-950/40 p-2 leading-5 text-amber-100">{annyProfileBusy ? '⏳ ' : ''}{annyProfileMessage}</div>}
        {annyProfileCandidates.length > 0 && <div className="mt-3 rounded-xl border border-amber-500/30 bg-slate-900/80 p-3">
          <div className="font-bold text-amber-200">مرشحات محيط الجسم • مراجعة فقط</div>
          <p className="mt-1 text-[10px] leading-4 text-slate-400">القيم التالية مستخرجة من مقاطع هندسية استدلالية ومحوّلة بمقياس الطول الحالي. ليست قياسات خياطة مؤكدة ولا تعديلاً لشكل المجسم.</p>
          {!state.measurementProfile && <p className="mt-1 text-[10px] text-amber-200">أدخل قياسات الصدر والخصر والورك في ملف القياسات لمقارنة المرشحات بها.</p>}
          <div className="mt-2 space-y-2">
            {annyProfileCandidates.map(candidate => <div key={candidate.zone} className="rounded-lg border border-slate-700 bg-slate-950/70 p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-white">{candidate.zone === 'hip' ? 'الورك' : candidate.zone === 'waist' ? 'الخصر' : 'الصدر'}</span>
                <span className="rounded-full border border-amber-500/40 px-2 py-0.5 text-[10px] text-amber-200">يتطلب مراجعة</span>
              </div>
              <div className="mt-1 grid grid-cols-2 gap-1 text-[10px] text-slate-300">
                <span>المحيط المرشح: <b className="text-cyan-200">{candidate.circumferenceCm.toFixed(1)} سم</b></span>
                <span>موضع الارتفاع: <b>{(candidate.heightFraction * 100).toFixed(1)}%</b></span>
                <span>المسارات المغلقة: <b>{candidate.contourCount}</b></span>
                <span>مؤشر هندسي: <b>{(candidate.heuristicConfidence * 100).toFixed(0)}%</b></span>
                {candidate.targetCircumferenceCm !== null && <span>قياسك المسجل: <b className="text-white">{candidate.targetCircumferenceCm.toFixed(1)} سم</b></span>}
                {candidate.differenceCm !== null && <span>الفرق عن قياسك: <b className={Math.abs(candidate.differenceCm) > 3 ? 'text-amber-200' : 'text-emerald-200'}>{candidate.differenceCm > 0 ? '+' : ''}{candidate.differenceCm.toFixed(1)} سم</b></span>}
              </div>
              {candidate.diagnostics.length > 0 && <p className="mt-1 text-[10px] leading-4 text-amber-300">تنبيهات: {candidate.diagnostics.join('، ')}</p>}
            </div>)}
          </div>
        </div>}
        {annyApiConnected && <div className="mt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-cyan-200">معاملات Anny الأصلية</span>
            <span className="text-[10px] text-slate-400">{annyPhenotypeLabels.length} معاملاً</span>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
            {annyPhenotypeLabels.map(label => <label key={label} className="block rounded-lg bg-slate-900/80 border border-slate-800 p-2">
              <div className="flex items-center justify-between gap-2">
                <code className="text-[10px] text-slate-300" dir="ltr">{label}</code>
                <span className="tabular-nums text-cyan-200">{(annyPhenotypes[label] ?? 0.5).toFixed(2)}</span>
              </div>
              <input aria-label={`قيمة معامل ${label}`} className="w-full mt-1 accent-cyan-400" type="range" min="0" max="1" step="0.01" value={annyPhenotypes[label] ?? 0.5} onChange={event => setAnnyPhenotypes(previous => ({ ...previous, [label]: Number(event.target.value) }))} />
            </label>)}
          </div>
          <p className="mt-2 text-[10px] leading-4 text-amber-200">هذه معاملات شكل داخل نموذج Anny وليست محيطات بالسنتيمتر. لا تستخدمها كبديل عن معايرة قياسات الخياطة.</p>
        </div>}
      </section>}

      {sewingPanelOpen && cadDocument && cadSewingAudit && <section
        className="absolute bottom-16 right-3 z-30 w-[min(28rem,calc(100vw-1.5rem))] max-h-[62vh] overflow-y-auto rounded-2xl border border-cyan-500/40 bg-slate-950/95 p-3 text-right text-xs text-white shadow-2xl backdrop-blur-md"
        dir="rtl"
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="font-bold text-sm text-cyan-200">وصلات الخياطة بين قطع الباترون</div>
            <div className="mt-1 text-[10px] text-slate-400">اقتراحات هندسية مبنية على نوع الحافة وطول المنحنى الفعلي</div>
          </div>
          <button onClick={() => setSewingPanelOpen(false)} className="rounded-lg px-2 py-1 bg-slate-800 text-slate-300">إغلاق</button>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1 text-center">
          <div className="rounded-lg bg-slate-900 p-2"><div className="text-lg font-bold text-emerald-300 tabular-nums">{cadSewingAudit.readyCount}</div><div className="text-[10px] text-slate-400">متوافقة</div></div>
          <div className="rounded-lg bg-slate-900 p-2"><div className="text-lg font-bold text-amber-300 tabular-nums">{cadSewingAudit.easeCount + cadSewingAudit.mismatchCount}</div><div className="text-[10px] text-slate-400">تحتاج مراجعة</div></div>
          <div className="rounded-lg bg-slate-900 p-2"><div className="text-lg font-bold text-cyan-300 tabular-nums">{cadSewingAudit.unpairedEdgeCount}</div><div className="text-[10px] text-slate-400">حواف غير موصولة</div></div>
        </div>
        {cadSewingAudit.items.length > 0 && <div className="mt-3 space-y-2">
          <div className="font-semibold text-slate-200">الوصلات المعتمدة</div>
          {cadSewingAudit.items.map(item => <div key={item.pairId} className="rounded-lg border border-slate-700 bg-slate-900/80 p-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-white">{item.firstPieceName} ↔ {item.secondPieceName}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] ${item.status === 'ready' ? 'bg-emerald-900/60 text-emerald-200' : item.status === 'invalid' ? 'bg-rose-900/60 text-rose-200' : 'bg-amber-900/60 text-amber-200'}`}>
                {item.status === 'ready' ? 'متوافقة' : item.status === 'invalid' ? 'غير صالحة' : item.status === 'ease-required' ? 'تحتاج تسهيل' : 'فرق طول'}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-slate-400">
              <span>{item.edgeType ?? 'حافة'} • {item.firstLengthCm.toFixed(1)} / {item.secondLengthCm.toFixed(1)} سم</span>
              <span>فرق {item.differenceCm.toFixed(2)} سم</span>
            </div>
            <div className="mt-1 text-[10px] text-slate-400">{item.messageAr}</div>
            <button onClick={() => removeCadStitchPair(item.pairId)} className="mt-2 rounded-md border border-rose-700/50 px-2 py-1 text-[10px] text-rose-200 hover:bg-rose-950/50">إزالة الوصلة</button>
          </div>)}
        </div>}
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="font-semibold text-slate-200">حواف مرشحة للوصل</div>
            <span className="text-[10px] text-slate-500">{cadSewingAudit.suggestions.length} اقتراح</span>
          </div>
          {cadSewingAudit.suggestions.slice(0, 8).map(suggestion => <div key={suggestion.id} className="rounded-lg border border-slate-700 bg-slate-900/80 p-2">
            <div className="font-semibold text-white">{suggestion.firstPieceName} ↔ {suggestion.secondPieceName}</div>
            <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-slate-400">
              <span>{suggestion.edgeType} • {suggestion.firstLengthCm.toFixed(1)} / {suggestion.secondLengthCm.toFixed(1)} سم</span>
              <span>فرق {suggestion.differenceCm.toFixed(2)} سم</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] text-cyan-200">مؤشر التوافق {(suggestion.confidence * 100).toFixed(0)}%</span>
              <div className="flex flex-wrap gap-1">
                <button onClick={() => acceptCadSeamSuggestion(suggestion, 'plain')} className="rounded-lg border border-cyan-600/60 px-2 py-1.5 font-semibold text-cyan-100 hover:bg-cyan-950/60">خياطة عادية</button>
                {suggestion.differenceCm > 0.35 && <button onClick={() => acceptCadSeamSuggestion(suggestion, 'ease')} className="rounded-lg bg-cyan-700 px-2 py-1.5 font-semibold text-white hover:bg-cyan-600">تسهيل {suggestion.differenceCm.toFixed(1)} سم</button>}
              </div>
            </div>
          </div>)}
          {!cadSewingAudit.suggestions.length && <div className="rounded-lg border border-dashed border-slate-700 p-3 text-center text-slate-400">لا توجد حواف إضافية متقاربة بما يكفي. راجع أطوال القطع أو اربط الحواف يدوياً في مرحلة إدارة الخياطة.</div>}
        </div>
        <p className="mt-3 border-t border-slate-800 pt-2 text-[10px] leading-4 text-amber-200">
          هذه طبقة ربط وتدقيق هندسي محفوظة مع المشروع. لا تقوم بعدُ بخياطة القطع في الفضاء ثلاثي الأبعاد أو بمحاكاة انسياب القماش.
        </p>
      </section>}

      {/* Floating Bottom Toolbar (Toggles & Export) */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-slate-900/90 backdrop-blur-md px-2 sm:px-3 py-1.5 rounded-2xl border border-slate-700/60 shadow-2xl max-w-[95vw] overflow-x-auto">
        {cadPieceCount > 0 && <button onClick={() => setShowCadPieces(value => !value)} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium border ${showCadPieces ? 'bg-amber-600/30 text-amber-100 border-amber-500/50' : 'text-amber-200 border-amber-700/40 hover:bg-amber-900/30'}`} title="عرض قطع CAD المحفوظة بالمقياس الهندسي في مساحة 3D؛ هذه معاينة مسطحة وليست محاكاة ارتداء">
          <Layers className="w-3.5 h-3.5" /><span>{showCadPieces ? 'إخفاء قطع CAD' : `قطع CAD (${cadPieceCount})`}</span>
        </button>}
        {cadDocument && cadSewingAudit && <button
          onClick={() => setSewingPanelOpen(value => !value)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium border ${sewingPanelOpen ? 'bg-cyan-600/30 text-cyan-100 border-cyan-500/50' : 'text-cyan-200 border-cyan-700/40 hover:bg-cyan-900/30'}`}
          title="مراجعة وصلات الخياطة المقترحة بين حواف قطع الباترون"
        >
          <Scissors className="w-3.5 h-3.5" /><span>الخياطة ({cadSewingAudit.readyCount}/{cadSewingAudit.pairCount})</span>
        </button>}
        <button onClick={() => annyFileInputRef.current?.click()} className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-cyan-200 hover:bg-cyan-900/40 border border-cyan-700/40" title="تحميل جسم Anny بصيغة GLB للمعاينة فقط">
          <Download className="w-3.5 h-3.5" /><span>تحميل Anny GLB</span>
        </button>
        <button disabled={annyBundledBusy} onClick={() => void handleLoadBundledAnny()} className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-emerald-200 hover:bg-emerald-900/40 border border-emerald-700/40 disabled:opacity-50" title="Anny هو الجسم الافتراضي للمعاينة؛ القياسات والملاءمة غير معايرة بعد">
          <Activity className="w-3.5 h-3.5" /><span>{annyBundledBusy ? 'جار تحميل Anny...' : 'إعادة تحميل Anny'}</span>
        </button>
        {annyPreviewEnabled && <>
          <button onClick={() => setShowGarmentOnAnny(value => !value)} className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border ${showGarmentOnAnny ? 'bg-emerald-600/20 text-emerald-200 border-emerald-500/40' : 'bg-slate-800 text-slate-300 border-slate-700'}`} title="تشكيل سطح الملابس ليتبع شبكة جسم Anny الفعلية">{showGarmentOnAnny ? 'إخفاء الملابس' : 'عرض الملابس'}</button>
        </>}

        <button
          onClick={() => setPresentationMode(mode => mode === 'luxury' ? 'atelier' : 'luxury')}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-colors ${presentationMode === 'luxury' ? 'bg-amber-500/20 text-amber-200 border-amber-400/50' : 'text-slate-300 border-slate-700 hover:bg-slate-800'}`}
          title="تبديل إضاءة وخلفية عرض المنتج؛ لا يغيّر هندسة الجسم أو الملابس"
        >
          <Sparkles className="w-3.5 h-3.5" /><span>{presentationMode === 'luxury' ? 'عرض فاخر' : 'استوديو فاخر'}</span>
        </button>

        {/* Turntable Auto-rotate */}
        <button
          onClick={() => setAutoRotate(!autoRotate)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
            autoRotate ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50' : 'text-slate-300 hover:bg-slate-800'
          }`}
          title="تدوير جسم Anny تلقائياً"
        >
          {autoRotate ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          <span>{autoRotate ? 'إيقاف الدوران' : 'دوران 360°'}</span>
        </button>

        <div className="w-px h-5 bg-slate-700/80 mx-0.5" />

        {/* Toggle Seams */}
        <button
          onClick={() => setShowSeams(!showSeams)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
            showSeams ? 'bg-purple-600/20 text-purple-300 border border-purple-500/50' : 'text-slate-400 hover:bg-slate-800'
          }`}
          title="إظهار خطوط الخياطة والغرز"
        >
          <Scissors className="w-3.5 h-3.5" />
          <span>خطوط الخياطة</span>
        </button>

        {/* Fit Heatmap */}
        <button
          onClick={() => setShowHeatmap(!showHeatmap)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
            showHeatmap ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/50' : 'text-slate-400 hover:bg-slate-800'
          }`}
          title="خريطة شد الباترون وراحة المقاس"
        >
          <Activity className="w-3.5 h-3.5" />
          <span>خريطة الشد والراحة</span>
        </button>

        <div className="w-px h-5 bg-slate-700/80 mx-0.5" />

        {/* Fit the whole model in view */}
        <button
          onClick={() => frameScene(true)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
          title="ملء العرض على جسم Anny والثوب كاملين"
        >
          <Maximize2 className="w-3.5 h-3.5 text-teal-300" />
          <span>ملء العرض</span>
        </button>

        <div className="w-px h-5 bg-slate-700/80 mx-0.5" />

        {/* Snapshot PNG */}
        <button
          onClick={handleSnapshot}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
          title="التقاط صورة عالية الدقة للتصميم"
        >
          <Camera className="w-3.5 h-3.5 text-pink-400" />
          <span>لقطة شاشة</span>
        </button>

        {/* Export portable GLB with supported materials */}
        <button
          onClick={() => { void handleExportGlb(); }}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-cyan-200 hover:bg-cyan-900/30 transition-colors"
          title="تصدير الملابس بصيغة GLB مع المواد المدعومة"
        >
          <Download className="w-3.5 h-3.5 text-cyan-300" />
          <span>تصدير GLB</span>
        </button>
        {/* Export the visible body and garment together */}
        <button
          onClick={() => { void handleExportSceneGlb(); }}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-emerald-200 hover:bg-emerald-900/30 transition-colors"
          title="تصدير العناصر الظاهرة معاً: الجسم والملابس أو معاينة Anny"
        >
          <Download className="w-3.5 h-3.5 text-emerald-300" />
          <span>تصدير المشهد GLB</span>
        </button>
        {/* Export OBJ */}
        <button
          onClick={handleExportObj}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
          title="تصدير المجسم بصيغة Wavefront OBJ"
        >
          <Download className="w-3.5 h-3.5 text-cyan-400" />
          <span>تصدير OBJ</span>
        </button>
      </div>

      {/* Heatmap Legend when active */}
      {showHeatmap && (
        <div className="absolute bottom-16 left-4 z-10 bg-slate-900/90 backdrop-blur-md p-3 rounded-xl border border-slate-700/60 shadow-xl text-xs text-white flex flex-col gap-1.5">
          <div className="font-semibold text-slate-200 text-[11px] mb-1">مقياس شد الباترون والتطابق:</div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-slate-300">مقاس مريح (براح 2-4 سم)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-400" />
            <span className="text-slate-300">مقاس فضفاض / واسع</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500" />
            <span className="text-slate-300">مشدود / ضيق (يحتاج توسيع)</span>
          </div>
        </div>
      )}
    </div>
  );
}
