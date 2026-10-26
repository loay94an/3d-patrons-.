import * as THREE from 'three';

export type FabricCategory = 'luxury' | 'everyday' | 'heavy' | 'light' | 'stretch';

export type PatternPrintType = 'solid' | 'pinstripe' | 'breton' | 'plaid' | 'polka' | 'houndstooth' | 'damask';

export interface FabricDefinition {
  id: string;
  nameAr: string;
  nameEn: string;
  category: FabricCategory;
  descriptionAr: string;
  defaultColor: string;
  roughness: number;
  metalness: number;
  sheen: number;
  sheenRoughness?: number;
  clearcoat?: number;
  transmission?: number; // for chiffon/sheer
  opacity: number;
  bumpScale: number;
  stiffness: number; // 0 = very fluid (silk), 1 = very stiff (raw denim)
  weightGsm: number; // grams per square meter
  stretchPercent: number;
  weaveType: 'plain' | 'twill' | 'satin' | 'knit' | 'leather' | 'fuzz' | 'lace';
}

export const FABRIC_PRESETS: FabricDefinition[] = [
  {
    id: 'silk',
    nameAr: 'حرير طبيعي (Pure Silk)',
    nameEn: 'Mulberry Silk',
    category: 'luxury',
    descriptionAr: 'قماش فاخر بانسيابية عالية ولمعان حريري ناعم مع بريق ضوئي مميز.',
    defaultColor: '#f5e6d3',
    roughness: 0.28,
    metalness: 0.05,
    sheen: 0.85,
    sheenRoughness: 0.25,
    clearcoat: 0.3,
    transmission: 0.0,
    opacity: 1.0,
    bumpScale: 0.08,
    stiffness: 0.15,
    weightGsm: 75,
    stretchPercent: 5,
    weaveType: 'satin'
  },
  {
    id: 'cotton_poplin',
    nameAr: 'قطن مصري بوبلين (Cotton Poplin)',
    nameEn: 'Egyptian Cotton Poplin',
    category: 'everyday',
    descriptionAr: 'نسيج قطني كلاسيكي ناعم ومتماسك بلمسة غير لامعة، مثالي للقمصان والبلوزات.',
    defaultColor: '#ffffff',
    roughness: 0.75,
    metalness: 0.0,
    sheen: 0.1,
    opacity: 1.0,
    bumpScale: 0.18,
    stiffness: 0.45,
    weightGsm: 130,
    stretchPercent: 8,
    weaveType: 'plain'
  },
  {
    id: 'denim',
    nameAr: 'جينز دَنيم كلاسيكي (Raw Denim)',
    nameEn: 'Classic Denim',
    category: 'heavy',
    descriptionAr: 'نسيج قطني مبروم بخطوط مائلة (Twill)، قوي وقاسي ذو ثبات عالي وملمس مميز.',
    defaultColor: '#1d4ed8',
    roughness: 0.85,
    metalness: 0.02,
    sheen: 0.05,
    opacity: 1.0,
    bumpScale: 0.45,
    stiffness: 0.85,
    weightGsm: 380,
    stretchPercent: 4,
    weaveType: 'twill'
  },
  {
    id: 'wool_tweed',
    nameAr: 'صوف جوخ وتويد (Wool Tweed)',
    nameEn: 'Wool Tweed & Cashmere',
    category: 'heavy',
    descriptionAr: 'صوف دافئ وسميك بملمس وبري غني وانسدال متزن، مناسب للبليزر والمعاطف.',
    defaultColor: '#475569',
    roughness: 0.92,
    metalness: 0.0,
    sheen: 0.35,
    opacity: 1.0,
    bumpScale: 0.4,
    stiffness: 0.7,
    weightGsm: 320,
    stretchPercent: 6,
    weaveType: 'fuzz'
  },
  {
    id: 'linen',
    nameAr: 'كتان طبيعي صيفي (Pure Linen)',
    nameEn: 'Natural Slub Linen',
    category: 'everyday',
    descriptionAr: 'نسيج كتان عضوي مريح بخيوط بارزة وانثناءات طبيعية تمنح أناقة صيفية عصرية.',
    defaultColor: '#e2d5c4',
    roughness: 0.82,
    metalness: 0.0,
    sheen: 0.12,
    opacity: 1.0,
    bumpScale: 0.35,
    stiffness: 0.55,
    weightGsm: 190,
    stretchPercent: 3,
    weaveType: 'plain'
  },
  {
    id: 'satin',
    nameAr: 'ساتان دوقة فاخر (Duchess Satin)',
    nameEn: 'Duchess Satin',
    category: 'luxury',
    descriptionAr: 'ساتان كثيف ببريق لؤلؤي ساطع ولمعان عاكس، مثالي لفساتين السهرة والمناسبات.',
    defaultColor: '#be185d',
    roughness: 0.2,
    metalness: 0.08,
    sheen: 0.95,
    clearcoat: 0.5,
    opacity: 1.0,
    bumpScale: 0.06,
    stiffness: 0.35,
    weightGsm: 210,
    stretchPercent: 6,
    weaveType: 'satin'
  },
  {
    id: 'chiffon',
    nameAr: 'شيفون هوائي شفاف (Airy Chiffon)',
    nameEn: 'Silk Chiffon',
    category: 'light',
    descriptionAr: 'قماش رقيق للغاية وشبه شفاف بانسيابية هوائية وتموجات حالمة ناعمة.',
    defaultColor: '#fda4af',
    roughness: 0.4,
    metalness: 0.0,
    sheen: 0.4,
    transmission: 0.65,
    opacity: 0.75,
    bumpScale: 0.12,
    stiffness: 0.1,
    weightGsm: 45,
    stretchPercent: 10,
    weaveType: 'plain'
  },
  {
    id: 'leather',
    nameAr: 'جلد طبيعي نابا (Supple Leather)',
    nameEn: 'Nappa Leather',
    category: 'heavy',
    descriptionAr: 'جلد ناعم بحبيبات دقيقة ولمعان خفيف يعطي إطلالة راقية وثباتاً معمارياً.',
    defaultColor: '#262626',
    roughness: 0.42,
    metalness: 0.06,
    sheen: 0.2,
    clearcoat: 0.4,
    opacity: 1.0,
    bumpScale: 0.5,
    stiffness: 0.9,
    weightGsm: 450,
    stretchPercent: 5,
    weaveType: 'leather'
  },
  {
    id: 'velvet',
    nameAr: 'مخمل ملكي (Royal Velvet)',
    nameEn: 'Royal Velour & Velvet',
    category: 'luxury',
    descriptionAr: 'نسيج مخملي وبري عميق يعكس الضوء بزوايا مائلة بألوان مشبعة دافئة.',
    defaultColor: '#4c0519',
    roughness: 0.65,
    metalness: 0.02,
    sheen: 1.0,
    sheenRoughness: 0.4,
    opacity: 1.0,
    bumpScale: 0.3,
    stiffness: 0.4,
    weightGsm: 310,
    stretchPercent: 12,
    weaveType: 'fuzz'
  },
  {
    id: 'jersey',
    nameAr: 'جيرسيه مطاط (Stretch Jersey)',
    nameEn: 'Cotton Stretch Jersey',
    category: 'stretch',
    descriptionAr: 'قماش تريكو حلقي مطاطي يلتف حول ثنيات الجسم بنعومة ومرونة فائقة.',
    defaultColor: '#0f766e',
    roughness: 0.7,
    metalness: 0.0,
    sheen: 0.25,
    opacity: 1.0,
    bumpScale: 0.22,
    stiffness: 0.2,
    weightGsm: 180,
    stretchPercent: 35,
    weaveType: 'knit'
  },
  {
    id: 'damask',
    nameAr: 'جاكار دمشقي مطرز (Damask Jacquard)',
    nameEn: 'Damask Jacquard',
    category: 'luxury',
    descriptionAr: 'نسيج مزخرف بنقوش متباينة بين اللمعان والمط التراثي الأنيق.',
    defaultColor: '#78350f',
    roughness: 0.45,
    metalness: 0.1,
    sheen: 0.7,
    opacity: 1.0,
    bumpScale: 0.38,
    stiffness: 0.6,
    weightGsm: 260,
    stretchPercent: 6,
    weaveType: 'satin'
  }
];

export interface FabricCustomState {
  presetId: string;
  color: string;
  pattern: PatternPrintType;
  patternScale: number; // 1 to 5
  roughness: number;
  sheen: number;
  opacity: number;
  stiffness: number;
}

export const DEFAULT_FABRIC_STATE: FabricCustomState = {
  presetId: 'cotton_poplin',
  color: '#3b82f6',
  pattern: 'solid',
  patternScale: 2,
  roughness: 0.7,
  sheen: 0.2,
  opacity: 1.0,
  stiffness: 0.45
};

// Procedural Canvas Texture Generation
export function generateProceduralFabricTexture(
  fabric: FabricDefinition,
  color: string,
  pattern: PatternPrintType,
  patternScale: number = 2
): { diffuse: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const size = 512;
  
  // Diffuse Canvas
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Bump Canvas
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bumpCtx = bumpCanvas.getContext('2d')!;

  // Fill base color
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);

  bumpCtx.fillStyle = '#808080';
  bumpCtx.fillRect(0, 0, size, size);

  // Apply pattern print
  applyPatternPrint(ctx, color, pattern, patternScale, size);

  // Apply microscopic weave texture
  applyMicroWeave(ctx, bumpCtx, fabric.weaveType, size);

  const diffuse = new THREE.CanvasTexture(canvas);
  diffuse.wrapS = THREE.RepeatWrapping;
  diffuse.wrapT = THREE.RepeatWrapping;
  diffuse.repeat.set(4, 4);
  diffuse.colorSpace = THREE.SRGBColorSpace;

  const bump = new THREE.CanvasTexture(bumpCanvas);
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;
  bump.repeat.set(8, 8);

  return { diffuse, bump };
}

function applyPatternPrint(
  ctx: CanvasRenderingContext2D,
  baseColor: string,
  pattern: PatternPrintType,
  scale: number,
  size: number
) {
  if (pattern === 'solid') return;

  const contrastColor = getContrastAccentColor(baseColor);
  ctx.save();

  if (pattern === 'pinstripe') {
    const spacing = 16 / scale;
    ctx.strokeStyle = contrastColor;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.65;
    for (let x = 0; x < size; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size);
      ctx.stroke();
    }
  } else if (pattern === 'breton') {
    const bandHeight = 32 / scale;
    ctx.fillStyle = contrastColor;
    ctx.globalAlpha = 0.85;
    for (let y = 0; y < size; y += bandHeight * 2) {
      ctx.fillRect(0, y, size, bandHeight);
    }
  } else if (pattern === 'polka') {
    const step = 40 / scale;
    const radius = 6 / scale;
    ctx.fillStyle = contrastColor;
    ctx.globalAlpha = 0.75;
    for (let y = step / 2; y < size; y += step) {
      for (let x = step / 2; x < size; x += step) {
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (pattern === 'plaid') {
    const step = 64 / scale;
    ctx.fillStyle = contrastColor;
    ctx.globalAlpha = 0.35;
    for (let x = 0; x < size; x += step) {
      ctx.fillRect(x, 0, step / 3, size);
      ctx.fillRect(0, x, size, step / 3);
    }
    ctx.strokeStyle = contrastColor;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6;
    for (let x = 0; x < size; x += step) {
      ctx.beginPath();
      ctx.moveTo(x + step / 2, 0);
      ctx.lineTo(x + step / 2, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, x + step / 2);
      ctx.lineTo(size, x + step / 2);
      ctx.stroke();
    }
  } else if (pattern === 'houndstooth') {
    const step = 32 / scale;
    ctx.fillStyle = contrastColor;
    ctx.globalAlpha = 0.8;
    for (let y = 0; y < size; y += step) {
      for (let x = 0; x < size; x += step) {
        if ((Math.floor(x / step) + Math.floor(y / step)) % 2 === 0) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + step / 2, y);
          ctx.lineTo(x + step, y + step / 2);
          ctx.lineTo(x + step / 2, y + step);
          ctx.lineTo(x, y + step);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
  } else if (pattern === 'damask') {
    const step = 60 / scale;
    ctx.strokeStyle = contrastColor;
    ctx.fillStyle = contrastColor;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 2;
    for (let y = 0; y < size; y += step) {
      for (let x = 0; x < size; x += step) {
        ctx.beginPath();
        ctx.ellipse(x + step / 2, y + step / 2, step / 4, step / 3, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x + step / 2, y + step / 2, step / 8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  ctx.restore();
}

function applyMicroWeave(
  diffuseCtx: CanvasRenderingContext2D,
  bumpCtx: CanvasRenderingContext2D,
  weave: FabricDefinition['weaveType'],
  size: number
) {
  const diffuseData = diffuseCtx.getImageData(0, 0, size, size);
  const bumpData = bumpCtx.getImageData(0, 0, size, size);
  const d = diffuseData.data;
  const b = bumpData.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      let noise = 0;

      if (weave === 'plain') {
        // Simple over-under checker
        const isUp = ((x % 4 < 2) !== (y % 4 < 2));
        noise = isUp ? 18 : -18;
      } else if (weave === 'twill') {
        // Diagonal ribbing
        const diag = (x + y * 2) % 6;
        noise = diag < 3 ? 24 : -24;
      } else if (weave === 'satin') {
        // Smooth minimal grain with fine horizontal streaks
        const fine = Math.sin(y * 1.5) * 8;
        noise = fine;
      } else if (weave === 'knit') {
        // Ribbed column loops
        const col = Math.sin(x * 0.8) * 20;
        const row = Math.sin(y * 0.4) * 10;
        noise = col + row;
      } else if (weave === 'leather') {
        // Cellular pebble grain
        const cell = Math.sin(x * 0.15) * Math.cos(y * 0.15) * 28 + (Math.random() - 0.5) * 10;
        noise = cell;
      } else if (weave === 'fuzz') {
        // Fuzzy wool random noise
        noise = (Math.random() - 0.5) * 36;
      } else {
        noise = (Math.random() - 0.5) * 14;
      }

      // Slightly modulate diffuse brightness
      d[idx] = Math.min(255, Math.max(0, d[idx] + noise * 0.35));
      d[idx + 1] = Math.min(255, Math.max(0, d[idx + 1] + noise * 0.35));
      d[idx + 2] = Math.min(255, Math.max(0, d[idx + 2] + noise * 0.35));

      // Bump height
      const bumpVal = Math.min(255, Math.max(0, 128 + noise * 1.5));
      b[idx] = bumpVal;
      b[idx + 1] = bumpVal;
      b[idx + 2] = bumpVal;
    }
  }

  diffuseCtx.putImageData(diffuseData, 0, 0);
  bumpCtx.putImageData(bumpData, 0, 0);
}

function getContrastAccentColor(hex: string): string {
  // Simple brightness calc
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16) || 0;
  const g = parseInt(c.substring(2, 4), 16) || 0;
  const b = parseInt(c.substring(4, 6), 16) || 0;
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 140 ? '#1e293b' : '#f8fafc';
}

export function createFabricThreeMaterial(
  fabricState: FabricCustomState
): THREE.MeshPhysicalMaterial {
  const preset = FABRIC_PRESETS.find(f => f.id === fabricState.presetId) || FABRIC_PRESETS[1];
  const { diffuse, bump } = generateProceduralFabricTexture(
    preset,
    fabricState.color,
    fabricState.pattern,
    fabricState.patternScale
  );

  const mat = new THREE.MeshPhysicalMaterial({
    map: diffuse,
    bumpMap: bump,
    bumpScale: preset.bumpScale,
    roughness: fabricState.roughness,
    metalness: preset.metalness,
    sheen: fabricState.sheen,
    sheenColor: new THREE.Color(fabricState.color).multiplyScalar(1.2),
    sheenRoughness: preset.sheenRoughness ?? 0.3,
    clearcoat: preset.clearcoat ?? 0.0,
    clearcoatRoughness: 0.1,
    transmission: preset.transmission ?? 0.0,
    transparent: fabricState.opacity < 1.0,
    opacity: fabricState.opacity,
    side: THREE.DoubleSide
  });

  return mat;
}
