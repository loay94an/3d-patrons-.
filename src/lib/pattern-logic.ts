import { womenSizes, menSizes, kidsSizes, infantMeasurements } from './measurements';

export type Gender = 'women' | 'men' | 'kids' | 'infant';
export type SizeSystem = 'eu' | 'us' | 'arab' | 'asian';
export type Unit = 'cm' | 'in';
export type GarmentType = 
  | 'tshirt'
  | 'polo'
  | 'romper'
  | 'blouse' 
  | 'shirt'
  | 'dress' 
  | 'pants' 
  | 'shorts'
  | 'pajamas'
  | 'skirt' 
  | 'abaya' 
  | 'coat' 
  | 'jumpsuit'
  | 'vest'
  | 'hoodie'
  | 'blazer'
  | 'kimono'
  | 'culottes'
  | 'cape';

export type School = 'mukai' | 'italian' | 'french' | 'german' | 'american' | 'arab' | 'asian';
export type FabricType = 'woven' | 'stretchy' | 'heavy' | 'light';
export type SleeveType = 'basic' | 'twopiece' | 'raglan';

export interface AppState {
  gender: Gender;
  system: SizeSystem;
  unit: Unit;
  garment: GarmentType;
  school: School;
  sleeve: SleeveType;
  fabric: FabricType;
  stretchPercent: number;
  size: number | string;
  includeSeam: boolean;
  useCustomMode: boolean;
  customMeasurements: Record<string, number>;
}

export const detailedNames = ["عرض الظهر","طول الكتف","طول الظهر","طول الكم","محيط الذراع","محيط الأسوارة","محيط الرقبة","محيط الصدر","محيط الخصر","محيط الورك","المسافة من الخصر إلى الورك","المسافة من الخصر إلى الركبة","طول الساق من الخصر إلى أسفل القدم","طول التنورة","طول الصدر (من أعلى الكتف مروراً فوق الصدر)","محيط الإبط (دوران الإبط)","المسافة من الخصر إلى الإبط","المسافة من أعلى الكتف إلى الثدي","المسافة بين الثديين","محيط الفخذ","محيط الركبة","محيط الكاحل","ارتفاع السرج","طول الجنب"];

export const patternNames = ["طول الظهر","عرض الظهر (نصف)","طول الكتف","ميلان الكتف","ربع محيط الرقبة","عرض حفرة الرقبة الأمامية","عرض حفرة الرقبة الخلفية","نزول الرقبة الأمامية","نزول الرقبة الخلفية","طول حردة الإبط (تقديري)","عمق حردة الإبط","ربع محيط الصدر","عرض الصدر الأمامي","عرض الصدر الخلفي","ربع محيط الخصر","ربع محيط الورك","ارتفاع الورك","طول الصدر","المسافة من الخصر إلى الإبط","المسافة بين الثديين","طول البنطلون","طول التنورة","ربع محيط الفخذ","ربع محيط الركبة","ربع محيط الكاحل","ارتفاع السرج","عرض خط السرج الأمامي","عرض خط السرج الخلفي","طول الساق","المسافة من الخصر إلى الركبة","طول الكم","نصف محيط الذراع","ارتفاع رأس الكم","نصف عرض الكم","نصف محيط الأسوارة","طول الرسغ إلى المرفق","طول المرفق إلى الكتف"];

export function getGarmentLabel(garment: GarmentType): string {
  const labels: Record<GarmentType, string> = {
    tshirt: 'تيشيرت أساسي قطن',
    polo: 'قميص بولو بياقة',
    romper: 'أفرول / سالوبيت رضيع',
    blouse: 'بلوزة كلاسيكية',
    shirt: 'قميص بأزرار وياقة',
    dress: 'فستان كلاسيكي',
    pants: 'بنطلون كلاسيكي',
    shorts: 'شورت كاجوال',
    pajamas: 'بيجاما مريحة منزلية',
    skirt: 'تنورة مستقيمة',
    abaya: 'عباءة خليجية / كيمونو واسع',
    coat: 'معطف شتوي / ترنش كوت',
    jumpsuit: 'جمبسوت عصري',
    vest: 'سديري / فيست بدلة',
    hoodie: 'هودي / سترة بقبعة',
    blazer: 'بليزر رسمي كلاسيكي',
    kimono: 'كيمونو ياباني / روب لف',
    culottes: 'بنطلون كولوتيس واسع',
    cape: 'كاب / بونشو كلاسيكي'
  };
  return labels[garment] || garment;
}

export function getSchoolLabel(school: School): string {
  const labels: Record<School, string> = {
    mukai: 'طريقة مارلين موكاي (Marlene Mukai)',
    italian: 'الإيطالية (Sartorial)',
    french: 'الفرنسية (ESMOD)',
    german: 'الألمانية (M. Müller & Sohn)',
    american: 'الأمريكية (Armstrong)',
    arab: 'العربية (خليجية/مغاربية)',
    asian: 'الآسيوية (Bunka / كورية)'
  };
  return labels[school] || school;
}

export function getFabricLabel(fabric: FabricType): string {
  const labels: Record<FabricType, string> = {
    woven: 'قماش منسوج (ثابت/غير مطاط)',
    stretchy: 'قماش ليكرا / استرتش مطاط',
    heavy: 'قماش ثقيل (جوخ/معاطف)',
    light: 'قماش خفيف (حرير/شيفون)'
  };
  return labels[fabric] || fabric;
}

export function getGenderLabel(gender: Gender): string {
  const labels: Record<Gender, string> = {
    women: 'نساء',
    men: 'رجال',
    kids: 'أطفال',
    infant: 'رضع'
  };
  return labels[gender] || gender;
}

export function getSizeList(gender: Gender): (number | string)[] {
  if (gender === 'women') return [34, 36, 38, 40, 42, 44, 46, 48, 50, 52, 54, 56, 58];
  if (gender === 'men') return [38, 40, 42, 44, 46, 48, 50, 52, 54, 56, 58];
  if (gender === 'kids') return [2, 4, 6, 8, 10, 12, 14];
  return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]; // months
}

export function mapSizeBySystem(raw: number | string, system: SizeSystem, gender: Gender): number | string {
  if (typeof raw === 'string') return raw;
  if (system === 'us' && gender === 'women') {
    const map: Record<number, number> = { 34: 4, 36: 6, 38: 8, 40: 10, 42: 12, 44: 14, 46: 16, 48: 18, 50: 20, 52: 22, 54: 24, 56: 26, 58: 28 };
    return map[raw] || raw;
  }
  if (system === 'arab' && gender === 'women') return raw + 4;
  if (system === 'asian' && gender === 'women') return raw - 26;
  if (system === 'us' && gender === 'men') return raw - 30;
  if (system === 'arab' && gender === 'men') return raw + 2;
  if (system === 'asian' && gender === 'men') return raw - 10;
  return raw;
}

export function getBaseMeasurements(gender: Gender, size: number | string) {
  if (gender === 'women') return womenSizes[size as number] || womenSizes[38];
  if (gender === 'men') return menSizes[size as number] || menSizes[46];
  if (gender === 'kids') return kidsSizes[String(size)] || kidsSizes["6"];
  return infantMeasurements(size as number);
}

export function applyFabricAdjustments(meas: any, fabric: FabricType, stretchPercent: number, garment: GarmentType) {
  let res = { ...meas };
  
  // Stretch reduction
  if (fabric === 'stretchy') {
    let factor = 1 - (stretchPercent / 100);
    for (let k in res) {
      if (['chest', 'bust', 'waist', 'hip', 'backWidth', 'shoulder', 'armCirc', 'cuffCirc', 'neckCirc', 'thighCirc', 'kneeCirc', 'ankleCirc'].includes(k)) {
        res[k] = res[k] * factor;
      }
    }
  }

  // Garment specific adjustments (Marlene Mukai & Classical Models)
  if (garment === 'tshirt') {
    res.shoulder = (res.shoulder || 12) + 1.0; // relaxed drop
    res.armholeDepth = (res.armholeDepth || 20) + 1.0;
    res.sleeveLength = res.bodyLength ? 18 : (res.sleeveLength > 40 ? 22 : 14); // short sleeve
  } else if (garment === 'polo') {
    res.shoulder = (res.shoulder || 12) + 0.8;
    res.armholeDepth = (res.armholeDepth || 20) + 1.0;
    res.sleeveLength = res.sleeveLength > 40 ? 24 : 15;
  } else if (garment === 'romper') {
    res.backLength = res.bodyLength ? (res.bodyLength * 0.48) : (res.backLength || 20);
    res.crotchHeight = res.crotchHeight || 14;
    res.legLength = res.bodyLength || 42;
  } else if (garment === 'shorts') {
    res.pantsLength = res.waistToKnee ? (res.waistToKnee - 5) : 45;
  } else if (garment === 'pajamas') {
    res.shoulder = (res.shoulder || 12) + 1.5;
    res.armholeDepth = (res.armholeDepth || 20) + 2.0;
  } else if (garment === 'abaya') {
    res.sleeveLength = (res.sleeveLength || 60) + 5;
    res.skirtLength = (res.skirtLength || 100) + 10;
  } else if (garment === 'coat') {
    res.shoulder = (res.shoulder || 12) + 1.2;
    res.armholeDepth = (res.armholeDepth || 21) + 2.5;
  } else if (garment === 'blazer') {
    res.shoulder = (res.shoulder || 12) + 0.8;
    res.armholeDepth = (res.armholeDepth || 21) + 1.5;
  } else if (garment === 'hoodie') {
    res.shoulder = (res.shoulder || 12) + 2.5;
    res.armholeDepth = (res.armholeDepth || 21) + 3;
    res.backLength = (res.backLength || 40) + 5;
  } else if (garment === 'shirt') {
    res.shoulder = (res.shoulder || 12) + 0.5;
    res.backLength = (res.backLength || 40) + 6;
  } else if (garment === 'vest') {
    res.shoulder = (res.shoulder || 12) - 1.5;
    res.armholeDepth = (res.armholeDepth || 21) + 1;
  } else if (garment === 'kimono') {
    res.shoulder = (res.shoulder || 12) + 4;
    res.sleeveLength = (res.sleeveLength || 60) - 5;
  } else if (garment === 'culottes') {
    res.skirtLength = 75;
    res.pantsLength = 75;
  } else if (garment === 'cape') {
    res.shoulder = (res.shoulder || 12) + 3;
    res.backLength = (res.backLength || 40) + 30;
  }

  if (res.bust === undefined && res.chest) res.bust = res.chest;
  return res;
}

export function getMeasurements(state: AppState) {
  if (state.useCustomMode && Object.keys(state.customMeasurements).length) {
    return applyFabricAdjustments(state.customMeasurements, state.fabric, state.stretchPercent, state.garment);
  } else {
    return applyFabricAdjustments(getBaseMeasurements(state.gender, state.size), state.fabric, state.stretchPercent, state.garment);
  }
}

export function getBaseEase(school: School, garment: GarmentType, gender?: Gender) {
  let ease = { chest: 5, waist: 2.5, hip: 4.5, arm: 2.5, cuff: 1.5, thigh: 3.5, knee: 2.5, ankle: 2, crotch: 1.5 };
  
  switch (school) {
    case 'mukai': ease = { chest: 4.5, waist: 3.0, hip: 4.0, arm: 3.0, cuff: 2.0, thigh: 4.0, knee: 3.0, ankle: 2, crotch: 2.0 }; break;
    case 'italian': ease = { chest: 5, waist: 2.5, hip: 4.5, arm: 2.5, cuff: 1.5, thigh: 3.5, knee: 2.5, ankle: 2, crotch: 1.5 }; break;
    case 'french': ease = { chest: 4, waist: 2.5, hip: 4.5, arm: 2.5, cuff: 1.5, thigh: 3.5, knee: 2.5, ankle: 2, crotch: 1.5 }; break;
    case 'german': ease = { chest: 5, waist: 3.5, hip: 5.5, arm: 3.5, cuff: 2, thigh: 4.5, knee: 3.5, ankle: 2.5, crotch: 2 }; break;
    case 'american': ease = { chest: 6.5, waist: 4, hip: 7, arm: 4.5, cuff: 2.5, thigh: 5.5, knee: 4.5, ankle: 3, crotch: 2.5 }; break;
    case 'arab': ease = { chest: 8, waist: 5, hip: 10, arm: 6, cuff: 3, thigh: 8, knee: 5, ankle: 4, crotch: 3 }; break;
    case 'asian': ease = { chest: 3, waist: 1.5, hip: 3.5, arm: 2.5, cuff: 1.5, thigh: 3.5, knee: 2.5, ankle: 2, crotch: 1 }; break;
  }

  // Garment specific ease overrides
  if (garment === 'tshirt') {
    ease.chest += 5; ease.waist += 6; ease.hip += 4; ease.arm += 4; ease.cuff += 3;
  } else if (garment === 'polo') {
    ease.chest += 4; ease.waist += 4; ease.hip += 4; ease.arm += 3; ease.cuff += 2;
  } else if (garment === 'romper') {
    ease.chest += 6; ease.waist += 8; ease.hip += 8; ease.arm += 4; ease.crotch += 4;
  } else if (garment === 'pajamas') {
    ease.chest += 8; ease.waist += 10; ease.hip += 10; ease.arm += 6; ease.thigh += 8; ease.crotch += 3;
  } else if (garment === 'shorts') {
    ease.waist += 3; ease.hip += 6; ease.thigh += 6; ease.crotch += 2;
  } else if (garment === 'abaya') {
    ease.chest += 10; ease.waist += 15; ease.hip += 15; ease.arm += 6; ease.cuff += 4;
  } else if (garment === 'coat') {
    ease.chest += 8; ease.waist += 6; ease.hip += 8; ease.arm += 5;
  } else if (garment === 'blazer') {
    ease.chest += 6; ease.waist += 4; ease.hip += 6; ease.arm += 4;
  } else if (garment === 'hoodie') {
    ease.chest += 12; ease.waist += 12; ease.hip += 10; ease.arm += 8; ease.cuff += 2;
  } else if (garment === 'shirt') {
    ease.chest += 6; ease.waist += 5; ease.hip += 6; ease.arm += 4; ease.cuff += 3;
  } else if (garment === 'vest') {
    ease.chest += 3; ease.waist += 2; ease.hip += 3; ease.arm = 0; ease.cuff = 0;
  } else if (garment === 'kimono') {
    ease.chest += 14; ease.waist += 20; ease.hip += 20; ease.arm += 10; ease.cuff += 8;
  } else if (garment === 'culottes') {
    ease.waist += 2; ease.hip += 8; ease.thigh += 12; ease.knee += 16; ease.ankle += 20; ease.crotch += 3;
  } else if (garment === 'cape') {
    ease.chest += 18; ease.waist += 25; ease.hip += 25; ease.arm = 0; ease.cuff = 0;
  } else if (garment === 'jumpsuit') {
    ease.crotch += 3;
    ease.waist += 2;
  }

  // Kids and baby ease adjustments for comfort
  if (gender === 'kids') {
    ease.chest = Math.max(ease.chest, 4);
    ease.waist = Math.max(ease.waist, 3);
  } else if (gender === 'infant') {
    ease.chest = Math.max(ease.chest, 4.5);
    ease.waist = Math.max(ease.waist, 4);
    ease.crotch = Math.max(ease.crotch, 3.5); // extra space for diapers
  }

  return ease;
}

export function getBaseSeam(school: School) {
  switch (school) {
    case 'mukai': return { side: 1.0, shoulder: 1.0, neckArmhole: 0.8, hem: 2.5 };
    case 'italian': return { side: 1.2, shoulder: 1.5, neckArmhole: 0.8, hem: 3.5 };
    case 'french': return { side: 1.0, shoulder: 1.5, neckArmhole: 0.8, hem: 3.0 };
    case 'german': return { side: 1.5, shoulder: 1.5, neckArmhole: 1.0, hem: 3.5 };
    case 'american': return { side: 1.5, shoulder: 1.5, neckArmhole: 1.0, hem: 4.5 };
    case 'arab': return { side: 1.8, shoulder: 1.8, neckArmhole: 1.1, hem: 5.0 };
    case 'asian': return { side: 1.0, shoulder: 1.0, neckArmhole: 0.8, hem: 2.5 };
    default: return { side: 1.0, shoulder: 1.0, neckArmhole: 0.8, hem: 2.5 };
  }
}

export function getEase(state: AppState) {
  if (state.fabric === 'stretchy') return { chest: 0, waist: 0, hip: 0, arm: 0, cuff: 0, thigh: 0, knee: 0, ankle: 0, crotch: 0 };
  let base = getBaseEase(state.school, state.garment, state.gender);
  let factor = state.fabric === 'heavy' ? 1.2 : state.fabric === 'light' ? 0.8 : 1.0;
  let res: any = {};
  for (let k in base) res[k] = (base as any)[k] * factor;
  return res;
}

export function getSeam(state: AppState) {
  if (!state.includeSeam) return { side: 0, shoulder: 0, neckArmhole: 0, hem: 0 };
  let base = getBaseSeam(state.school);
  let factor = state.fabric === 'stretchy' ? 0.6 : state.fabric === 'heavy' ? 1.3 : state.fabric === 'light' ? 0.8 : 1.0;
  let res: any = {};
  for (let k in base) res[k] = (base as any)[k] * factor;
  return res;
}

export function computeSchoolValues(meas: any, school: School, fabric: FabricType, gender?: Gender) {
  let chest = meas.bust ?? meas.chest;
  let neck = meas.neckCirc;
  let backLen = meas.backLength;
  let isInfant = gender === 'infant' || meas.neckCirc < 26;
  let isChild = gender === 'kids' || (meas.neckCirc >= 26 && meas.neckCirc < 34);

  let neckWidth: number;
  let frontNeckDrop: number;
  let backNeckDrop: number;
  let shoulderSlope: number;
  let armholeDepth: number;
  
  if (isInfant) {
    // Baby anatomical drafting (Mukai Bebê standard)
    neckWidth = (neck / 6) + 0.5;
    frontNeckDrop = (neck / 6) + 1.2;
    backNeckDrop = 1.0;
    shoulderSlope = 1.2;
    armholeDepth = meas.armholeDepth || ((chest / 4) - 0.5);
  } else if (isChild) {
    // Children anatomical drafting (Mukai Infantil standard)
    neckWidth = (neck / 6) + 0.8;
    frontNeckDrop = (neck / 6) + 1.5;
    backNeckDrop = 1.3;
    shoulderSlope = 2.2;
    armholeDepth = meas.armholeDepth || ((chest / 4) - 1.0);
  } else {
    // Adult drafting
    switch (school) {
      case 'mukai': 
        neckWidth = (neck / 6) + 0.5;
        frontNeckDrop = (neck / 6) + 1.5;
        backNeckDrop = 1.5;
        armholeDepth = meas.armholeDepth || ((chest / 4) - 1.5);
        shoulderSlope = meas.shoulder > 13 ? 4.0 : 3.5;
        break;
      case 'french': 
        neckWidth = (neck / 5) + 0.5; 
        frontNeckDrop = (neck / 5) + 2.0; 
        backNeckDrop = 2.0;
        armholeDepth = backLen / 2; 
        shoulderSlope = 4.8; 
        break;
      case 'italian': 
        neckWidth = (neck / 5) + 1.0; 
        frontNeckDrop = (neck / 5) + 1.0; 
        backNeckDrop = 2.0;
        armholeDepth = (chest / 4) - 2.0; 
        shoulderSlope = 4.2; 
        break;
      case 'german': 
        neckWidth = (neck / 5) + 0.5; 
        frontNeckDrop = (neck / 5) + 1.0; 
        backNeckDrop = 2.2;
        armholeDepth = (chest / 10) + 10.8; 
        shoulderSlope = 4.5; 
        break;
      case 'american': 
        neckWidth = (neck / 5) + 1.0; 
        frontNeckDrop = (neck / 5) + 1.0; 
        backNeckDrop = 2.0;
        armholeDepth = (chest / 4) - 1.2; 
        shoulderSlope = 4.3; 
        break;
      case 'arab': 
        neckWidth = (neck / 5) + 0.5; 
        frontNeckDrop = (neck / 5) + 1.5; 
        backNeckDrop = 2.2;
        armholeDepth = (chest / 4) - 1.5; 
        shoulderSlope = 4.0; 
        break;
      case 'asian': 
        neckWidth = (neck / 5); 
        frontNeckDrop = (neck / 5); 
        backNeckDrop = 1.8;
        armholeDepth = (chest / 4) - 2.5; 
        shoulderSlope = 3.8; 
        break;
      default: 
        neckWidth = (neck / 6) + 0.5; 
        frontNeckDrop = (neck / 6) + 1.5; 
        backNeckDrop = 1.8;
        armholeDepth = 19.5; 
        shoulderSlope = 4.0;
    }
  }
  
  let adjust = fabric === 'stretchy' ? -0.5 : fabric === 'heavy' ? 0.5 : fabric === 'light' ? -0.3 : 0;
  armholeDepth += adjust;
  return { neckWidth, frontNeckDrop, backNeckDrop, shoulderSlope, armholeDepth };
}

export function computePatternValues(state: AppState) {
  let meas = getMeasurements(state);
  let s = computeSchoolValues(meas, state.school, state.fabric, state.gender);
  let ease = getEase(state);
  let seam = getSeam(state);
  
  let chest = meas.bust ?? meas.chest;
  let waist = meas.waist;
  let hip = meas.hip;
  let backWidth = meas.backWidth;
  let shoulder = meas.shoulder;
  
  let quarterChest = (chest / 4) + (ease.chest / 4);
  let quarterWaist = (waist / 4) + (ease.waist / 4);
  let quarterHip = (hip / 4) + (ease.hip / 4);
  let frontChestWidth = ((chest / 2) - backWidth) / 2 + (ease.chest / 4);
  let backChestWidth = backWidth / 2;
  
  let halfArmWithEase = (meas.armCirc / 2) + (ease.arm / 2);
  let halfCuffWithEase = (meas.cuffCirc / 2) + (ease.cuff / 2);
  let sleeveWidthHalf = halfArmWithEase;
  
  // Sleeve cap height calculation proportional to age / garment
  let capFactor = state.gender === 'infant' ? 0.52 : state.gender === 'kids' ? 0.65 : 0.78;
  if (state.garment === 'tshirt' || state.garment === 'hoodie') capFactor *= 0.85;
  let sleeveCapHeight = s.armholeDepth * capFactor;
  
  let quarterThigh = (meas.thighCirc / 4) + (ease.thigh / 4);
  let quarterKnee = (meas.kneeCirc / 4) + (ease.knee / 4);
  let quarterAnkle = (meas.ankleCirc / 4) + (ease.ankle / 4);
  
  // Crotch extension formulas (Marlene Mukai standard)
  let frontCrotch = (hip / 16) + (ease.crotch / 2);
  let backCrotch = (hip / 8) + (ease.crotch);
  if (state.gender === 'infant') {
    frontCrotch = 2.8 + (ease.crotch / 2);
    backCrotch = 5.0 + ease.crotch;
  } else if (state.gender === 'kids') {
    frontCrotch = 3.5 + (ease.crotch / 2);
    backCrotch = 6.5 + ease.crotch;
  }
  
  let neckQuarter = meas.neckCirc / 4;
  let estimatedArmholeCurve = (s.armholeDepth * 1.45) + (s.shoulderSlope / 2);

  let values = [
    meas.backLength + seam.hem,
    backWidth / 2 + seam.side,
    shoulder + seam.shoulder,
    s.shoulderSlope,
    neckQuarter + seam.neckArmhole,
    s.neckWidth,
    s.neckWidth,
    s.frontNeckDrop,
    s.backNeckDrop,
    estimatedArmholeCurve + seam.neckArmhole,
    s.armholeDepth,
    quarterChest + seam.side,
    frontChestWidth + seam.side,
    backChestWidth + seam.side,
    quarterWaist + seam.side,
    quarterHip + seam.side,
    meas.waistToHip,
    meas.chestLength,
    meas.waistToArmpit,
    meas.bustPointDist ?? meas.chestPointDist,
    (meas.pantsLength ?? meas.legLength) + seam.hem,
    meas.skirtLength + seam.hem,
    quarterThigh + seam.side,
    quarterKnee + seam.side,
    quarterAnkle + seam.side,
    meas.crotchHeight,
    frontCrotch + seam.side,
    backCrotch + seam.side,
    meas.legLength + seam.hem,
    meas.waistToKnee,
    meas.sleeveLength + seam.hem,
    halfArmWithEase + seam.side,
    sleeveCapHeight,
    sleeveWidthHalf + seam.side,
    halfCuffWithEase + seam.side,
    meas.sleeveLength / 2,
    meas.sleeveLength / 2
  ];
  
  return { values, s, ease, seam, meas };
}

