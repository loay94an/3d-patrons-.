import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import {
  RotateCcw, Eye, EyeOff, Camera, Layers,
  Activity, Play, Pause, Compass, ZoomIn, ZoomOut,
  Maximize2, Sparkles, Scissors, Shirt, Download, Palette, Sliders
} from 'lucide-react';
import { AppState, Gender } from '../lib/pattern-logic';
import { FabricCustomState, createFabricThreeMaterial, FABRIC_PRESETS } from '../lib/fabric-engine';
import { buildParametricMannequin, MannequinMeasurements, DEFAULT_MANNEQUIN_MEASUREMENTS } from '../lib/mannequin-builder';
import { generate3DGarmentMesh, Garment3DResult } from '../lib/garment-3d-generator';

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
  const [showSeams, setShowSeams] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
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

      if (autoRotate) {
        sphericalRef.current.theta += 0.008;
        updateCameraPosition();
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      if (reqIdRef.current) cancelAnimationFrame(reqIdRef.current);
      ro.disconnect();
      renderer.dispose();
    };
  }, []);

  // Synchronize Mannequin and Garment whenever State, Measurements, or Fabric changes
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // 1. Rebuild or Update Mannequin
    if (mannequinGroupRef.current) {
      scene.remove(mannequinGroupRef.current);
      mannequinGroupRef.current.traverse(obj => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
          else obj.material.dispose();
        }
      });
    }

    const meas = state.customMeasurements;
    const refMeas = DEFAULT_MANNEQUIN_MEASUREMENTS[state.gender] || DEFAULT_MANNEQUIN_MEASUREMENTS.women;

    const currentMeasurements: MannequinMeasurements = {
      bust: meas.bust ?? meas.chest ?? refMeas.bust,
      waist: meas.waist ?? refMeas.waist,
      hip: meas.hip ?? refMeas.hip,
      shoulder: meas.shoulder ?? refMeas.shoulder,
      backLength: meas.backLength ?? refMeas.backLength,
      height: 168
    };

    const mannequin = buildParametricMannequin(state.gender, currentMeasurements);
    mannequin.visible = showMannequin;
    scene.add(mannequin);
    mannequinGroupRef.current = mannequin;

    // 2. Rebuild Garment Mesh
    if (garmentResultRef.current) {
      scene.remove(garmentResultRef.current.group);
      garmentResultRef.current.group.traverse(obj => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
          else obj.material.dispose();
        }
      });
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
    scene.add(garmentResult.group);
    garmentResultRef.current = garmentResult;

    // Re-frame only while the user has not taken control of the camera.
    frameScene();
  }, [state.gender, state.garment, state.customMeasurements, fabricState, showHeatmap, showMannequin, showSeams, frameScene]);

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

      {/* Floating Bottom Toolbar (Toggles & Export) */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-slate-900/90 backdrop-blur-md px-2 sm:px-3 py-1.5 rounded-2xl border border-slate-700/60 shadow-2xl max-w-[95vw] overflow-x-auto">
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
          title="إظهار/إخفاء المانيكان الداخلي"
        >
          {showMannequin ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          <span>المانيكان</span>
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
