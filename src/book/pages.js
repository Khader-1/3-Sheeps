// The picture book, as data.
//
// One entry per page. Everything the renderer needs is declarative, so the
// book can be re-laid-out, re-ordered or re-translated without touching the
// drawing code — and so a page can be nudged by editing two numbers.
//
// Text is deliberately spare. The film has the full 27-scene script with all
// its dialogue; a picture book for this age carries one or two lines a page
// and lets the drawing do the rest. Dialogue that survives is in bubbles.
//
// Coordinates are in scene space: every background is 1280×720, the ground
// the characters stand on is around y=660, and x=640 is centre.

export const BOOK = {
  title: 'الخراف الثلاثة والذئب الماكر',
  subtitle: 'قصة مصوّرة للأطفال',
  width: 1280,
  height: 720,
};

const GROUND = 668;

export const PAGES = [
  // ---------------------------------------------------------------- cover
  {
    id: 'cover',
    kind: 'cover',
    scene: 'خلفيه 1',
    zoom: 1.05,
    cast: [
      { key: 'wolf', view: 'side', x: 1020, y: GROUND + 30, height: 470, flip: true, expr: 'menacing' },
      { key: 'big', x: 430, y: GROUND + 12, height: 330, expr: 'determined' },
      { key: 'mid', x: 215, y: GROUND + 12, height: 300, expr: 'afraid' },
      { key: 'small', x: 630, y: GROUND + 12, height: 272, expr: 'afraid', restArms: true },
    ],
  },

  // ---------------------------------------------------------------- story
  {
    id: 'p01',
    scene: 'خلفيه 1',
    text: 'فوق تلٍّ بعيد، عاش ثلاثةُ إخوةٍ صغار في كوخٍ قديم.',
    cast: [
      { key: 'big', x: 350, y: GROUND, height: 236, expr: 'neutral' },
      { key: 'mid', x: 205, y: GROUND, height: 214, expr: 'neutral' },
      { key: 'small', x: 480, y: GROUND, height: 192, expr: 'neutral', restArms: true },
    ],
  },
  {
    id: 'p02',
    scene: 'خلفيه 1',
    night: 0.62,
    rain: true,
    text: 'وفي ليلةٍ عاصفة، هبّت الريحُ على الكوخِ القديم.',
    cast: [],
  },
  {
    id: 'p03',
    scene: 'خلفيات 3و4و2',
    text: 'فسقطَ السقفُ… ولم يبقَ لهم بيتٌ يحميهم.',
    cast: [
      { key: 'big', x: 400, y: GROUND, height: 232, expr: 'worried' },
      { key: 'mid', x: 258, y: GROUND, height: 210, expr: 'afraid' },
      { key: 'small', x: 530, y: GROUND, height: 190, expr: 'afraid', restArms: true },
      { key: 'wolf', view: 'side', x: 1180, y: GROUND + 10, height: 300, flip: true, expr: 'menacing' },
    ],
  },
  {
    id: 'p04',
    scene: 'خلفيات 3و4و2',
    text: 'قال الأكبر: لنبنِ بيتاً واحداً متيناً. لكنّهم اختلفوا.',
    cast: [
      { key: 'big', x: 620, y: GROUND, height: 244, expr: 'determined' },
      { key: 'mid', x: 430, y: GROUND, height: 216, expr: 'neutral' },
      { key: 'small', x: 790, y: GROUND, height: 196, expr: 'neutral', restArms: true },
    ],
    bubbles: [
      { x: 620, y: 250, w: 300, text: 'لنبنِ بيتاً قوياً!', tail: [620, 430] },
    ],
  },
  {
    id: 'p05',
    scene: 'مشهد5',
    text: 'الأصغرُ كان كسولاً، فجمع القشَّ وانتهى سريعاً.',
    cast: [
      { key: 'small', x: 300, y: GROUND + 6, height: 250, expr: 'neutral', restArms: true },
    ],
  },
  {
    id: 'p06',
    scene: 'مشهد6',
    text: 'والأوسطُ جمع الحطبَ، وبنى بيته على عجل.',
    cast: [
      { key: 'mid', x: 610, y: GROUND + 6, height: 258, expr: 'neutral' },
    ],
  },
  {
    id: 'p07',
    scene: 'مشهد7',
    text: 'أمّا الأكبرُ فبنى بالحجارةِ والطين، وأتقنَ عملَه.',
    cast: [
      { key: 'big', x: 930, y: GROUND + 6, height: 280, expr: 'determined' },
    ],
  },
  {
    id: 'p08',
    scene: 'مشهد8',
    text: 'وذاتَ صباح، مرَّ ذئبٌ جائع.',
    cast: [
      { key: 'wolf', view: 'side', x: 820, y: GROUND + 14, height: 330, flip: true, expr: 'menacing' },
    ],
  },
  {
    id: 'p09',
    scene: 'مشهد9',
    text: 'فطرقَ بابَ بيتِ القشّ.',
    cast: [
      { key: 'wolf', view: 'side', expr: 'menacing',
        faceHouse: { match: 'بيت_قش', frac: 0.62, gap: 10 } },
    ],
    bubbles: [
      { x: 470, y: 190, w: 300, text: 'افتحِ البابَ أيها الخروف!', tail: [640, 330] },
    ],
  },
  {
    id: 'p10',
    scene: 'مشهد10',
    text: '',
    cast: [
      { key: 'small', x: 640, y: GROUND + 20, height: 300, expr: 'terrified', restArms: true },
    ],
    bubbles: [
      { x: 340, y: 170, w: 340, text: 'أنتَ أتيتَ لتأكلَني! لن أفتحَ لك!', tail: [560, 340] },
    ],
  },
  {
    id: 'p11',
    scene: 'مشهد11',
    text: 'فنفخَ… وتطايرَ القشُّ في الهواء.',
    cast: [
      { key: 'wolf', view: 'side', expr: 'menacing', blow: { power: 1.0 },
        faceHouse: { match: 'بيت_قش_من_الجمب', frac: 0.68, gap: 30 } },
    ],
  },
  {
    id: 'p12',
    scene: 'مشهد12',
    text: 'هربَ الأصغرُ إلى بيتِ أخيه المصنوعِ من الحطب.',
    cast: [
      { key: 'small', x: 700, y: GROUND + 8, height: 268, expr: 'terrified', restArms: true,
        poses: { 'الرجل_ش': { rotate: 26, pivot: [0.5, 0.04] }, 'الرجل_ي': { rotate: -26, pivot: [0.5, 0.04] } } },
    ],
  },
  {
    id: 'p13',
    scene: 'مشهد13',
    text: '',
    cast: [
      { key: 'mid', x: 470, y: GROUND + 24, height: 290, expr: 'worried' },
      { key: 'small', x: 810, y: GROUND + 24, height: 252, expr: 'terrified', restArms: true },
    ],
    bubbles: [
      { x: 250, y: 150, w: 290, text: 'ما الذي يحدثُ؟', tail: [430, 300] },
      { x: 760, y: 130, w: 330, text: 'الذئبُ هدمَ بيتي!', tail: [830, 290] },
    ],
  },
  {
    id: 'p14',
    scene: 'مشهد14',
    text: 'ثم وجدَ الذئبُ بيتَ الحطب، وطرقَ البابَ من جديد.',
    cast: [
      { key: 'wolf', view: 'side', expr: 'menacing',
        faceHouse: { match: 'بيت_خشب_جاهز', frac: 0.62, gap: 10 } },
    ],
  },
  {
    id: 'p15',
    scene: 'مشهد16جزء2',
    text: 'ونفخَ نفخةً قوية… فسقطَ بيتُ الحطب.',
    cast: [
      { key: 'wolf', view: 'side', expr: 'menacing', blow: { power: 1.25 },
        faceHouse: { match: 'خشب_حطام', height: 300, gap: 40, side: 'left' } },
    ],
  },
  {
    id: 'p16',
    scene: 'مشهد17و18',
    text: '',
    cast: [
      { key: 'mid', x: 390, y: GROUND + 30, height: 268, expr: 'afraid' },
      { key: 'small', x: 900, y: GROUND + 30, height: 240, expr: 'terrified', restArms: true },
      { key: 'big', x: 645, y: GROUND + 34, height: 300, expr: 'determined' },
    ],
    bubbles: [
      { x: 640, y: 120, w: 360, text: 'لا تخافا، بيتي متين!', tail: [645, 300] },
    ],
  },
  {
    id: 'p17',
    scene: 'مشهد19',
    text: 'وصلَ الذئبُ إلى البيتِ المتين، وطرقَ بابَه.',
    cast: [
      { key: 'wolf', view: 'side', expr: 'menacing',
        faceHouse: { match: 'بيت_طوب_جاهز', frac: 0.6, gap: 10 } },
    ],
  },
  {
    id: 'p18',
    scene: 'مشهد21',
    text: 'نفخَ… ونفخَ… ونفخ. لكنّ البيتَ لم يتزحزح.',
    cast: [
      { key: 'wolf', view: 'side', expr: 'menacing', blow: { power: 1.35 },
        faceHouse: { match: 'بيت_طوب_من_الجمب', frac: 0.85, gap: 30 } },
    ],
  },
  {
    id: 'p19',
    scene: 'مشهد23',
    text: '',
    cast: [
      { key: 'mid', x: 300, y: GROUND + 30, height: 262, expr: 'worried' },
      { key: 'small', x: 700, y: GROUND + 30, height: 236, expr: 'afraid', restArms: true },
      { key: 'big', x: 495, y: GROUND + 34, height: 296, expr: 'determined' },
    ],
    bubbles: [
      { x: 470, y: 116, w: 330, text: 'عندي خطة…', tail: [495, 300] },
    ],
  },
  {
    id: 'p20',
    scene: 'مشهد25',
    text: 'نزلَ الذئبُ من المدخنة… فاحترقَ ذيلُه!',
    cast: [
      // Tipped head-down over the hearth: he is falling, not standing.
      { key: 'wolf', view: 'side', x: 1035, y: 430, height: 290, flip: true,
        rotate: 150, expr: 'terrified', motion: 'up',
        burning: { scale: 1.35 } },
    ],
  },
  {
    id: 'p21',
    scene: 'مشهد26',
    text: 'وهربَ يعدو في الغابةِ بعيداً، ولم يعُد.',
    cast: [
      // Fleeing left, away from the house — and the burning tail trails behind.
      { key: 'wolf', view: 'side', x: 470, y: GROUND + 10, height: 300, flip: true, expr: 'afraid',
        burning: { scale: 0.85 },
        poses: { 'الرجل__و': { rotate: 34, pivot: [0.5, 0.04] }, 'الرجل_ق': { rotate: -34, pivot: [0.5, 0.04] } } },
    ],
  },

  // ----------------------------------------------------------------- end
  {
    id: 'end',
    kind: 'moral',
    scene: 'المشهد27الاخير',
    text: 'أتقِنْ عملَك… فالبيتُ المتينُ يحميكَ يوماً ما.',
    cast: [
      { key: 'big', x: 640, y: GROUND, height: 246, expr: 'determined' },
      { key: 'mid', x: 470, y: GROUND, height: 222, expr: 'neutral' },
      { key: 'small', x: 800, y: GROUND, height: 200, expr: 'neutral', restArms: true },
    ],
  },
];
