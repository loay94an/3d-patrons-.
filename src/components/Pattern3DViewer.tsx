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
import { buildParametricMannequin, MannequinMeasurements, DEFAULT_MANNEQUIN_MEASUREMENTS } from '../lib/mannequin-builder';
import { generate3DGarmentMesh, Garment3DResult } from '../lib/garment-3d-generator';

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
    if (!(object instanceof THREE.Mesh)) return;

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

interface Pattern3DViewerProps {
  state: AppState;
  fabricState: FabricCustomState;
  onOpenFabricDrawer?: () => void;
  onOpenMeasurementsDrawer?: () => void;
  isSplitView?: boolean;
}

export function Pattern3DViewer({
  state,
  fabricState,
  onOpenFabricDrawer,
  onOpenMeasurementsDrawer,
  isSplitView = false
}: Pattern3DViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const mannequinGroupRef = useRef<THREE.Group | null>(null);
  const annyGroupRef = useRef<THREE.Group | null>(null);
  const annyFileInputRef = useRef<HTMLInputElement>(null);
  const garmentResultRef = useRef<Garment3DResult | null>(null);
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
  const [showMannequin, setShowMannequin] = useState(true);
  const [annyPreviewEnabled, setAnnyPreviewEnabled] = useState(false);
  const [annyFileName, setAnnyFileName] = useState('');
  const [annyLoadError, setAnnyLoadError] = useState('');
  const [annyApiUrl, setAnnyApiUrl] = useState(import.meta.env.VITE_ANNY_API_URL ?? '');
  const [annyApiPanelOpen, setAnnyApiPanelOpen] = useState(false);
  const [annyApiBusy, setAnnyApiBusy] = useState(false);
  const [annyApiMessage, setAnnyApiMessage] = useState('');
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
    scene.add(keyLight);

    // Fill Light
    const fillLight = new THREE.DirectionalLight(0xdbeafe, 1.3);
    fillLight.position.set(-70, 80, -40);
    scene.add(fillLight);

    // Rim / Back Light (creates elegant fashion studio edge highlight)
    const rimLight = new THREE.DirectionalLight(0xfef08a, 1.8);
    rimLight.position.set(0, 110, -90);
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

  // Synchronize Mannequin and Garment whenever State, Measurements, or Fabric changes
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // 1. Rebuild or Update Mannequin
    if (mannequinGroupRef.current) {
      scene.remove(mannequinGroupRef.current);
      disposeObjectResources(mannequinGroupRef.current);
    }

    const meas = state.customMeasurements;
    const refMeas = DEFAULT_MANNEQUIN_MEASUREMENTS[state.gender] || DEFAULT_MANNEQUIN_MEASUREMENTS.women;

    const currentMeasurements: MannequinMeasurements = {
      bust: meas.bust ?? meas.chest ?? refMeas.bust,
      waist: meas.waist ?? refMeas.waist,
      hip: meas.hip ?? refMeas.hip,
      shoulder: meas.shoulder ?? refMeas.shoulder,
      backLength: meas.backLength ?? refMeas.backLength,
      height: meas.height ?? refMeas.height
    };

    const mannequin = buildParametricMannequin(state.gender, currentMeasurements);
    mannequin.visible = showMannequin && !annyPreviewEnabled;
    scene.add(mannequin);
    mannequinGroupRef.current = mannequin;

    // 2. Rebuild Garment Mesh
    if (garmentResultRef.current) {
      scene.remove(garmentResultRef.current.group);
      disposeObjectResources(garmentResultRef.current.group);
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
        sleeveLength: meas.sleeveLength ?? 58,
        totalLength: meas.skirtLength ?? 65,
        fabricState,
        showHeatmap
      },
      fabricMat
    );

    garmentResult.seamLinesGroup.visible = showSeams;
    garmentResult.group.visible = !annyPreviewEnabled;
    scene.add(garmentResult.group);
    garmentResultRef.current = garmentResult;

    // Re-frame only while the user has not taken control of the camera.
    frameScene();
  }, [state.gender, state.garment, state.customMeasurements, fabricState, showHeatmap, showMannequin, showSeams, annyPreviewEnabled, frameScene]);

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
  const installAnnyScene = (bodyScene: THREE.Object3D, sourceName: string) => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (annyGroupRef.current) {
      scene.remove(annyGroupRef.current);
      disposeObjectResources(annyGroupRef.current);
      annyGroupRef.current = null;
    }
    const group = new THREE.Group();
    group.name = 'AnnyBodyPreview';
    group.add(bodyScene);
    // Anny's native mesh is Z-up. Convert it to this viewer's Y-up world.
    group.rotation.x = -Math.PI / 2;
    const bounds = new THREE.Box3().setFromObject(group);
    const size = bounds.getSize(new THREE.Vector3());
    if (!Number.isFinite(size.y) || size.y <= 0) {
      disposeObjectResources(group);
      throw new Error('ملف Anny لا يحتوي على مجسم صالح.');
    }
    group.scale.setScalar(168 / size.y);
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
    setAnnyFileName(sourceName);
    setAnnyPreviewEnabled(true);
    requestAnimationFrame(() => frameScene(true));
  };

  const getAnnyApiBaseUrl = () => annyApiUrl.trim().replace(/\\/+$/, '');

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
        body: JSON.stringify({ phenotypes: annyPhenotypes })
      });
      if (!response.ok) throw new Error(await readAnnyApiError(response));
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength < 20) throw new Error('استجابة GLB فارغة أو غير مكتملة.');
      const gltf = await new GLTFLoader().parseAsync(buffer, '');
      installAnnyScene(gltf.scene, 'Anny API • ' + new Date().toLocaleString());
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
    setAnnyLoadError('');
    const objectUrl = URL.createObjectURL(file);
    const loader = new GLTFLoader();
    loader.load(objectUrl, (gltf) => {
      URL.revokeObjectURL(objectUrl);
      try {
        installAnnyScene(gltf.scene, file.name);
        setAnnyLoadError('');
      } catch (error) {
        setAnnyLoadError(error instanceof Error ? error.message : 'ملف GLB لا يحتوي على مجسم صالح.');
      }
    }, undefined, () => {
      URL.revokeObjectURL(objectUrl);
      setAnnyLoadError('تعذر فتح ملف GLB. تأكد من سلامة الملف.');
    });
    event.target.value = '';
  };

  const handleRemoveAnnyPreview = () => {
    const scene = sceneRef.current;
    const group = annyGroupRef.current;
    if (scene && group) { scene.remove(group); disposeObjectResources(group); annyGroupRef.current = null; }
    setAnnyPreviewEnabled(false);
    setAnnyFileName('');
    setAnnyLoadError('');
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
    if (annyPreviewEnabled && annyGroupRef.current) {
      exportObjects.push(annyGroupRef.current);
    } else {
      if (mannequinGroupRef.current?.visible) exportObjects.push(mannequinGroupRef.current);
      if (garmentResultRef.current?.group.visible) exportObjects.push(garmentResultRef.current.group);
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

      {annyLoadError && <div role="status" className="absolute top-16 left-3 right-3 z-20 rounded-lg border border-rose-500/40 bg-rose-950/90 px-3 py-2 text-xs text-rose-100">{annyLoadError}</div>}
      {glbExportError && <div role="status" className="absolute top-16 left-3 right-3 z-20 rounded-lg border border-rose-500/40 bg-rose-950/90 px-3 py-2 text-xs text-rose-100">{glbExportError}</div>}

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
        </div>
        {annyApiMessage && <div role="status" className="mt-2 rounded-lg bg-slate-900 border border-slate-700 p-2 leading-5 text-slate-300">{annyApiMessage}</div>}
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

      {/* Floating Bottom Toolbar (Toggles & Export) */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-slate-900/90 backdrop-blur-md px-2 sm:px-3 py-1.5 rounded-2xl border border-slate-700/60 shadow-2xl max-w-[95vw] overflow-x-auto">
        <button onClick={() => setAnnyApiPanelOpen(value => !value)} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium border ${annyApiPanelOpen ? 'bg-indigo-600/30 text-indigo-100 border-indigo-500/50' : 'text-indigo-200 hover:bg-indigo-900/40 border-indigo-700/40'}`} title="الاتصال بخدمة Anny وتوليد جسم مباشر">
          <Activity className="w-3.5 h-3.5" /><span>Anny API</span>
        </button>
        <button onClick={() => annyFileInputRef.current?.click()} className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-cyan-200 hover:bg-cyan-900/40 border border-cyan-700/40" title="تحميل جسم Anny بصيغة GLB للمعاينة فقط">
          <Download className="w-3.5 h-3.5" /><span>تحميل Anny GLB</span>
        </button>
        {annyPreviewEnabled && <button onClick={handleRemoveAnnyPreview} className="px-2.5 py-1.5 rounded-xl text-xs font-medium bg-amber-600/20 text-amber-200 border border-amber-500/40">إغلاق Anny</button>}

        {/* Turntable Auto-rotate */}
        <button
          onClick={() => setAutoRotate(!autoRotate)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
            autoRotate ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50' : 'text-slate-300 hover:bg-slate-800'
          }`}
          title="دوران المانيكان التلقائي"
        >
          {autoRotate ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          <span>{autoRotate ? 'إيقاف الدوران' : 'دوران 360°'}</span>
        </button>

        <div className="w-px h-5 bg-slate-700/80 mx-0.5" />

        {/* Toggle Mannequin visibility */}
        <button
          onClick={() => setShowMannequin(!showMannequin)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
            showMannequin ? 'bg-blue-600/20 text-blue-300 border border-blue-500/50' : 'text-slate-400 hover:bg-slate-800'
          }`}
          title={annyPreviewEnabled ? "معاينة Anny نشطة" : "إظهار/إخفاء المانيكان الداخلي"}
        >
          {showMannequin ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          <span>{annyPreviewEnabled ? 'Anny' : 'المانيكان'}</span>
        </button>

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
          title="ملء العرض على المانيكان والثوب كاملين"
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

      {annyPreviewEnabled && <div className="absolute bottom-16 right-3 z-10 max-w-[min(22rem,85vw)] rounded-xl border border-cyan-500/40 bg-slate-900/95 p-3 text-right text-xs text-cyan-100 shadow-xl">
        <div className="font-semibold">معاينة جسم Anny فقط</div><div className="mt-1 text-slate-300">{annyFileName}</div>
        <div className="mt-1 text-amber-200">ضُبط الارتفاع للعرض التقريبي فقط. القياسات غير معايرة، والباترون مخفي في هذه المعاينة.</div>
      </div>}

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
