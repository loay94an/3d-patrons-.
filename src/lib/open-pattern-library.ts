/**
 * Curated, measurement-driven garment pattern catalogue.
 *
 * This file contains original metadata and integration notes only. It does not
 * copy third-party pattern geometry or drafting code. Each pattern must be
 * implemented and validated against its cited drafting source before it is
 * advertised as production-ready.
 */

export type PatternFamily =
  | 'bodice' | 'shirt' | 'tee' | 'dress' | 'skirt' | 'trousers'
  | 'outerwear' | 'activewear' | 'underwear' | 'children' | 'traditional'
  | 'accessory';

export type PatternMaturity = 'catalogued' | 'draft-engine' | 'validated';

export interface MeasurementPatternModel {
  id: string;
  nameAr: string;
  nameEn: string;
  family: PatternFamily;
  garmentTypes: string[];
  variants: string[];
  requiredMeasurements: string[];
  optionalMeasurements: string[];
  easeProfile: 'negative' | 'close' | 'regular' | 'relaxed' | 'oversized';
  constructionNotesAr: string;
  sourceIds: string[];
  maturity: PatternMaturity;
}

export interface PatternResearchSource {
  id: string;
  name: string;
  url: string;
  license: string;
  integration: 'reference-only' | 'compatible-library' | 'copyleft-review';
  strengths: string[];
  limitations: string[];
}

export const OPEN_PATTERN_SOURCES: PatternResearchSource[] = [
  {
    id: 'freesewing',
    name: 'FreeSewing',
    url: 'https://github.com/freesewing/freesewing',
    license: 'MIT',
    integration: 'compatible-library',
    strengths: ['JavaScript/TypeScript ecosystem', 'parametric made-to-measure designs', 'modular geometry and plugins'],
    limitations: ['Each design still needs a deliberate adapter to the project CAD piece model', 'Check the license of every imported design and asset']
  },
  {
    id: 'jblockcreator',
    name: 'JBlockCreator',
    url: 'https://github.com/aharwood2/JBlockCreator',
    license: 'GPL-3.0',
    integration: 'copyleft-review',
    strengths: ['Measurement-driven 2D blocks', 'bodices, skirts, sleeves and trousers', 'DXF-oriented output and scan measurement inputs'],
    limitations: ['Java application; algorithms require careful porting', 'GPL-3.0 obligations must be reviewed before copying code']
  },
  {
    id: 'seamly2d',
    name: 'Seamly2D',
    url: 'https://github.com/FashionFreedom/Seamly2D',
    license: 'GPL-3.0-or-later',
    integration: 'copyleft-review',
    strengths: ['Parametric formula-based drafting', 'individual and multi-size measurement files', 'mature 2D patternmaking workflow'],
    limitations: ['C++/Qt application, not a drop-in browser library', 'GPL obligations apply to derivative distributed code']
  },
  {
    id: 'valentina',
    name: 'Valentina',
    url: 'https://gitlab.com/smart-pattern/valentina',
    license: 'GPL-3.0-or-later (verify current repository metadata)',
    integration: 'copyleft-review',
    strengths: ['Formula-based drafting', 'standard and individual measurement tables', 'reusable pattern construction'],
    limitations: ['Desktop C++/Qt codebase; use as a method reference unless licensing and porting are approved']
  },
  {
    id: 'costumy',
    name: 'Costumy',
    url: 'https://github.com/cdrinmatane/Costumy',
    license: 'Verify repository license before reuse',
    integration: 'reference-only',
    strengths: ['Connects body mesh measurements, FreeSewing patterns and 3D garment output', 'SVG/JSON/OBJ workflow'],
    limitations: ['Explicitly a prototype; not a production pattern engine']
  },
  {
    id: 'opensew',
    name: 'OpenSew-2',
    url: 'https://github.com/MarcelloMorettoni/opensew-2',
    license: 'Verify repository license before reuse',
    integration: 'reference-only',
    strengths: ['2D drafting, seam relationships, body measurement and cloth draping concepts'],
    limitations: ['Blender add-on workflow; geometry and simulation need an adapter']
  },
  {
    id: 'fashionmaker',
    name: 'FashionMaker / Valentina lineage',
    url: 'https://github.com/OpnTec/fashionmaker',
    license: 'GPL family; verify exact repository license',
    integration: 'copyleft-review',
    strengths: ['Historical patternmaking code and formula-based construction'],
    limitations: ['Do not copy code until provenance and exact license are checked']
  }
];

const commonBody = ['bust', 'waist', 'hip', 'backLength', 'shoulder', 'neckCirc'];
const sleeve = ['sleeveLength', 'armCirc', 'cuffCirc', 'armholeDepth'];
const lowerBody = ['waist', 'hip', 'crotchHeight', 'thighCirc', 'kneeCirc', 'ankleCirc', 'pantsLength'];
const length = ['bodyLength', 'waistToHip', 'waistToKnee'];

function model(
  id: string, nameAr: string, nameEn: string, family: PatternFamily,
  garmentTypes: string[], variants: string[], requiredMeasurements: string[],
  optionalMeasurements: string[], easeProfile: MeasurementPatternModel['easeProfile'],
  constructionNotesAr: string, sourceIds: string[] = ['freesewing', 'jblockcreator']
): MeasurementPatternModel {
  return { id, nameAr, nameEn, family, garmentTypes, variants, requiredMeasurements, optionalMeasurements, easeProfile, constructionNotesAr, sourceIds, maturity: 'catalogued' };
}

/**
 * Curated model index (not a claim that all world-wide drafting methods have
 * been implemented). Models become selectable generators only after their
 * drafting equations, seam matching and test fixtures are implemented.
 */
export const MEASUREMENT_PATTERN_LIBRARY: MeasurementPatternModel[] = [
  model('bodice-basic', 'أساس الصدرية', 'Basic bodice block', 'bodice', ['blouse','shirt','dress','vest','blazer'], ['أمامي وخلفي','بنسة كتف','بنسة خصر','بنسة صدر'], commonBody, ['frontLength','frontWidth','backWidth','bustPointDistance','bustHeight','waistToHip'], 'close', 'الأساس الذي تُبنى عليه البلوزات والفساتين والجاكيتات.'),
  model('bodice-princess', 'صدرية أميرة', 'Princess bodice', 'bodice', ['blouse','dress','coat'], ['أميرة من الكتف','أميرة من حردة الإبط','أميرة أمامية وخلفية'], [...commonBody,'bustPointDistance','bustHeight'], ['frontLength','backWidth'], 'close', 'نقل بنسات الصدر والخصر إلى خطوط قص أميرة مع مطابقة أطوال الخياطة.'),
  model('bodice-dartless', 'صدرية بلا بنسات', 'Dartless bodice', 'bodice', ['blouse','tshirt','dress'], ['مستقيم','واسع','منسدل'], commonBody, ['frontLength','backWidth'], 'relaxed', 'توزيع الاتساع على الجنب والكتف مع مراعاة القماش.'),
  model('bodice-wrap', 'صدرية لف', 'Wrap bodice', 'bodice', ['blouse','dress','kimono'], ['لف كامل','لف جزئي','رباط جانبي'], commonBody, ['frontLength','bustPointDistance','waistToHip'], 'regular', 'تداخل الأمام وتحديد امتداد الرباط.'),
  model('shirt-classic', 'قميص كلاسيكي', 'Classic button shirt', 'shirt', ['shirt'], ['رجالي','نسائي','أطفال','ياقة مدببة','ياقة كلاسيكية'], [...commonBody,...sleeve], ['frontLength','backWidth','cuffCirc','waistToHip'], 'regular', 'أمام بأزرار وظهر وكم وياقة وكمّية؛ يلزم ضبط رأس الكم مع حردة الإبط.'),
  model('shirt-oversized', 'قميص واسع', 'Oversized shirt', 'shirt', ['shirt'], ['كتف ساقط','ظهر بكسرة','جيب صدر'], ['bust','hip','bodyLength','shoulder'], [...sleeve,'backLength'], 'oversized', 'زيادة اتساع موزعة على الصدر والظهر والكم.'),
  model('shirt-tunic', 'قميص طويل / تونيك', 'Tunic shirt', 'shirt', ['shirt','abaya'], ['شق جانبي','ياقة مفتوحة','أزرار أمامية'], commonBody, [...sleeve,...length], 'relaxed', 'إطالة القميص مع ضبط اتساع الورك وفتحات الجنب.'),
  model('tee-basic', 'تيشيرت أساسي', 'Basic T-shirt', 'tee', ['tshirt'], ['ياقة دائرية','ياقة V','كم قصير','كم طويل'], ['bust','waist','hip','bodyLength','shoulder'], [...sleeve,'neckCirc'], 'regular', 'قماش مطاطي؛ تُراجع نسبة السالب ease مع نسبة الاستطالة.'),
  model('tee-raglan', 'تيشيرت راغلان', 'Raglan T-shirt', 'tee', ['tshirt','hoodie'], ['راغلان كلاسيكي','راغلان منحني','راغلان بقطعتين'], ['bust','waist','hip','bodyLength','neckCirc'], [...sleeve,'backLength'], 'regular', 'خط الكتف ينتقل إلى فتحة الرقبة؛ يحتاج تطابق درزات الراغلان.'),
  model('tee-polo', 'قميص بولو', 'Polo shirt', 'tee', ['polo'], ['ياقة بولو','فتحة قصيرة','كم مضلع'], ['bust','waist','hip','bodyLength','neckCirc'], sleeve, 'regular', 'إضافة فتحة أمامية وياقة وقطع أساور.'),
  model('dress-shift', 'فستان مستقيم', 'Shift dress', 'dress', ['dress'], ['بلا كم','كم قصير','شق خلفي'], commonBody, [...sleeve,...length], 'regular', 'خطوط جانبية مستقيمة نسبياً مع اتساع الحركة.'),
  model('dress-a-line', 'فستان A-line', 'A-line dress', 'dress', ['dress'], ['قصة خصر','قطعة واحدة','أميرة'], commonBody, [...sleeve,...length], 'relaxed', 'اتساع تدريجي من الصدر أو الخصر إلى الذيل.'),
  model('dress-fit-flare', 'فستان محدد وواسع', 'Fit-and-flare dress', 'dress', ['dress'], ['خصر طبيعي','خصر مرتفع','تنورة نصف دائرة'], [...commonBody,'bustPointDistance'], [...sleeve,...length], 'close', 'صدرية مضبوطة وتنورة منفصلة أو متصلة مع اتساع محسوب.'),
  model('dress-wrap', 'فستان لف', 'Wrap dress', 'dress', ['dress'], ['لف أمامي','لف جانبي','كم طويل'], commonBody, [...sleeve,...length], 'regular', 'تداخل الأمام ورباط الخصر وعمق فتحة مضبوط.'),
  model('dress-shirt', 'فستان قميص', 'Shirt dress', 'dress', ['dress','shirt'], ['أزرار كاملة','حزام','ياقة كلاسيكية'], [...commonBody,'bodyLength'], [...sleeve,'waistToHip'], 'relaxed', 'دمج أساس القميص مع طول الفستان وفتحات الجنب.'),
  model('skirt-straight', 'تنورة مستقيمة', 'Straight skirt', 'skirt', ['skirt'], ['شق خلفي','شق أمامي','خصر بحزام'], ['waist','hip','waistToHip'], ['waistToKnee','skirtLength'], 'close', 'أمام وخلف وبنسات ومقدار حركة عند الورك.'),
  model('skirt-pencil', 'تنورة قلم', 'Pencil skirt', 'skirt', ['skirt'], ['خصر مرتفع','خصر طبيعي','شق خلفي'], ['waist','hip','waistToHip','waistToKnee'], ['skirtLength'], 'close', 'تضييق مدروس عند الذيل مع شق للمشي.'),
  model('skirt-a-line', 'تنورة A-line', 'A-line skirt', 'skirt', ['skirt'], ['بنسات','كسرات','حزام'], ['waist','hip','waistToHip'], ['skirtLength'], 'relaxed', 'توسيع الجنب من الورك إلى الذيل.'),
  model('skirt-circle', 'تنورة دائرية', 'Circle skirt', 'skirt', ['skirt'], ['دائرة كاملة','نصف دائرة','ربع دائرة'], ['waist','skirtLength'], ['hip'], 'relaxed', 'حساب نصف قطر الخصر ومراعاة هبوط القماش قبل تسوية الذيل.'),
  model('skirt-gathered', 'تنورة بكسرات / تجميع', 'Gathered skirt', 'skirt', ['skirt'], ['كسرات صندوقية','كسرات سكين','تجميع'], ['waist','hip','skirtLength'], [], 'relaxed', 'تحديد نسبة التجميع أو عمق الكسرات وتوزيعها على القطع.'),
  model('trouser-basic', 'بنطلون أساسي', 'Basic trouser block', 'trousers', ['pants','jumpsuit'], ['أمام وخلف','خصر عادي','خصر مرتفع'], lowerBody, ['backLength','waistToHip','waistToKnee'], 'regular', 'ضبط الحجر الأمامي والخلفي وخط الركبة والفخذ ومطابقة الجانبين.'),
  model('trouser-straight', 'بنطلون مستقيم', 'Straight-leg trousers', 'trousers', ['pants'], ['خصر عادي','خصر مرتفع','ثنية أمامية'], lowerBody, ['waistToKnee'], 'regular', 'ساق مستقيمة من الركبة أو الفخذ وفق التصميم.'),
  model('trouser-wide', 'بنطلون واسع', 'Wide-leg trousers', 'trousers', ['pants','culottes'], ['بالازو','واسع من الورك','خصر مطاط'], lowerBody, ['waistToKnee'], 'relaxed', 'اتساع الساق مع توازن عرض الأمام والخلف.'),
  model('trouser-tapered', 'بنطلون يضيق للأسفل', 'Tapered trousers', 'trousers', ['pants'], ['تشينو','كاروت','كاحل ضيق'], lowerBody, ['waistToKnee'], 'close', 'تدرج تضييق الساق مع اختبار محيط الركبة والكاحل.'),
  model('trouser-jeans', 'جينز بخمس جيوب', 'Five-pocket jeans', 'trousers', ['pants'], ['سكيني','مستقيم','بوت كت'], [...lowerBody,'waistToKnee'], ['backLength'], 'close', 'قطع أمام وخلف ويوك وجيوب وحزام؛ يتطلب ضبط تراكب الخياطات.'),
  model('trouser-shorts', 'شورت', 'Shorts', 'trousers', ['shorts'], ['برمودا','قصير','رياضي'], ['waist','hip','crotchHeight','thighCirc'], ['pantsLength'], 'regular', 'اختصار طول البنطلون مع حفظ عمق الحجر ومحيط الفخذ.'),
  model('trouser-culottes', 'كولوت واسع', 'Culottes', 'trousers', ['culottes'], ['واسع جداً','طول متوسط','خصر مطاط'], lowerBody, ['skirtLength'], 'relaxed', 'بنطلون واسع يحاكي التنورة مع مراعاة الحجر وفتحة الساق.'),
  model('sleeve-basic', 'كم أساسي', 'Set-in sleeve', 'bodice', ['shirt','blouse','dress','coat'], ['قصير','ثلاثة أرباع','طويل','بكفّة'], [...sleeve,'shoulder'], ['bust','backWidth'], 'regular', 'يجب مساواة طول رأس الكم مع طول حردة الإبط بعد حساب ease الرأس.'),
  model('sleeve-two-piece', 'كم قطعتين', 'Two-piece sleeve', 'bodice', ['blazer','coat'], ['علوي وسفلي','مرفق مشكّل'], [...sleeve,'shoulder'], ['elbowCirc','wristToElbow'], 'close', 'تقسيم الكم إلى قطعتين لتشكيل انحناء المرفق.'),
  model('sleeve-puff', 'كم منفوش', 'Puff sleeve', 'bodice', ['blouse','dress'], ['نفخ أعلى','نفخ كامل','كشكشة عند الكف'], [...sleeve,'shoulder'], [], 'relaxed', 'توسيع رأس الكم أو الذيل ثم توزيع الكشكشة بالتساوي.'),
  model('outerwear-blazer', 'بليزر', 'Tailored blazer', 'outerwear', ['blazer'], ['مفرد','مزدوج','ياقة شال','ياقة مدببة'], [...commonBody,...sleeve], ['frontLength','backWidth','waistToHip'], 'regular', 'صدرية ببطانة ووجه ياقة وكمّين؛ يلزم ضبط الياقة والوجه.'),
  model('outerwear-coat', 'معطف', 'Coat', 'outerwear', ['coat'], ['ترنش','معطف مستقيم','معطف ملفوف','دبل بريست'], [...commonBody,...sleeve], [...length,'backWidth'], 'relaxed', 'سماحات طبقات الملابس والبطانة والياقة والكم.'),
  model('outerwear-hoodie', 'هودي', 'Hoodie', 'outerwear', ['hoodie'], ['جيب كنغر','سحاب','قبعة قطعتين'], ['bust','waist','hip','bodyLength','shoulder'], [...sleeve,'neckCirc'], 'oversized', 'قبعة متطابقة مع فتحة الرقبة وأساور وذيل مضلع.'),
  model('outerwear-cape', 'كاب / عباءة كتف', 'Cape', 'outerwear', ['cape','abaya'], ['دائري','مفتوح أمامياً','غطاء رأس'], ['neckCirc','shoulder','bodyLength'], ['bust','backLength'], 'oversized', 'توزيع الاتساع حول الكتفين وفتحات الذراع.'),
  model('traditional-abaya', 'عباءة', 'Abaya', 'traditional', ['abaya'], ['رأس','كتف','كيمونو','مفتوحة','مغلقة'], [...commonBody,'bodyLength'], [...sleeve,'armCirc','cuffCirc'], 'oversized', 'خيارات قصة الرأس والكتف والكم مع أطوال واسعة وفتحات أمامية.'),
  model('traditional-kimono', 'كيمونو', 'Kimono robe', 'traditional', ['kimono'], ['كم مستقيم','كم واسع','حزام لف'], ['bust','hip','bodyLength','shoulder','sleeveLength'], ['neckCirc'], 'oversized', 'كم متصل أو شبه متصل مع حزام ووجه أمامي.'),
  model('traditional-kaftan', 'قفطان', 'Kaftan', 'traditional', ['abaya','dress'], ['مستقيم','ياقة V','شقوق جانبية','أكمام واسعة'], ['bust','hip','bodyLength','shoulder'], [...sleeve,'neckCirc'], 'oversized', 'قصة واسعة مع ضبط فتحة الرقبة والأكمام والذيل.'),
  model('activewear-leggings', 'ليقنز', 'Leggings', 'activewear', ['pants'], ['خصر عالٍ','خصر متوسط','درزة جانبية'], ['waist','hip','crotchHeight','thighCirc','kneeCirc','ankleCirc','pantsLength'], [], 'negative', 'يعتمد على نسبة استطالة القماش؛ يجب اختبار الشد قبل اعتماد القياسات.'),
  model('activewear-sportsbra', 'حمالة رياضية', 'Sports bra', 'activewear', ['blouse'], ['ظهر متقاطع','دعم متوسط','دعم عالٍ'], ['bust','underBust','bustPointDistance'], ['shoulder','neckCirc'], 'negative', 'يتطلب محيط أسفل الصدر وخصائص استطالة وارتداد القماش.'),
  model('underwear-boxers', 'بوكسر', 'Boxer briefs', 'underwear', ['pants'], ['قصير','طويل','حزام مطاط'], ['waist','hip','thighCirc','crotchHeight'], ['pantsLength'], 'negative', 'إضافة مساحة حركة ودرزات داخلية مسطحة وحزام مطاط.'),
  model('children-basic', 'مجموعة أساسيات الأطفال', 'Children basics', 'children', ['tshirt','shirt','dress','pants','shorts'], ['رضيع','طفل','يافع'], ['chest','waist','hip','bodyLength'], [...sleeve,...lowerBody], 'relaxed', 'تدرج حسب الطول ومراحل النمو، مع سماحات راحة وحركة مناسبة.'),
  model('accessory-apron', 'مريلة', 'Apron', 'accessory', ['custom'], ['مريلة صدر','مريلة خصر','جيوب'], ['waist','bodyLength'], ['bust','hip'], 'relaxed', 'شكل بسيط مع أربطة وجيوب؛ مناسب كبداية لاختبار التصدير.'),
  model('accessory-bowtie', 'ربطة عنق فراشة', 'Bow tie', 'accessory', ['custom'], ['فراشة','ربطة قابلة للتعديل'], ['neckCirc'], [], 'close', 'مقاس الرقبة وعرض الربطة وطول الشريط.'),
  model('accessory-hat', 'قبعة بسيطة', 'Basic hat', 'accessory', ['custom'], ['قبعة مسطحة','قبعة ذات جوانب'], ['headCirc'], [], 'regular', 'يتطلب قياس الرأس وعمق القبعة؛ نموذج منفصل عن قوالب الملابس.')
];

export function getPatternModelsByFamily(family: PatternFamily): MeasurementPatternModel[] {
  return MEASUREMENT_PATTERN_LIBRARY.filter(item => item.family === family);
}

export function getPatternModel(id: string): MeasurementPatternModel | undefined {
  return MEASUREMENT_PATTERN_LIBRARY.find(item => item.id === id);
}
