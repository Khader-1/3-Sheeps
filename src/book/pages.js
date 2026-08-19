// The picture book, as data.
//
// One entry per page, in reading order. The drawings are delivered artwork —
// out/book-art/<id>.webp, built from assets/incoming/كتاب by tools/book-art.mjs
// — so a page here carries only what is laid *over* the picture: the narration
// and any speech.
//
// It was not always so. Every page used to be staged the way the poster is:
// name a background set, list the cast, give each character a position, a
// height, an expression and sometimes a pose, and let the renderer measure and
// place the rigs. That machinery is still here and the cover still uses it —
// see `kind: 'cover'` below and src/targets/book.js. The story pages no longer
// need it, and the staging fields they used to carry (scene, cast, night,
// rain, zoom) are gone rather than left to rot; git remembers them.
//
// Text is deliberately spare. The film has the full 27-scene script with all
// its dialogue; a picture book for this age carries one or two lines a page
// and lets the drawing do the rest. Dialogue that survives is in bubbles.
//
// Coordinates are in page space: 1280×720, x=640 centre. Bubbles are placed by
// hand against the artwork — `x` is the centre of the box, `y` its top, and
// `tail` the point it should aim at, which wants to be the speaker's muzzle.
// The narration card picks its own corner; `textAt` overrides that.

export const BOOK = {
  title: 'الخراف الثلاثة والذئب الماكر',
  subtitle: 'قصة مصوّرة للأطفال',
  width: 1280,
  height: 720,
};

const GROUND = 668;

export const PAGES = [
  // ---------------------------------------------------------------- cover
  // The one page with no delivered drawing, so it is still staged from the
  // set and the rigs — which suits it: the cover wants all four characters
  // together facing out, and no frame of the film has that.
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
    art: true,
    text: 'فوق تلٍّ بعيد، عاش ثلاثةُ إخوةٍ صغار في كوخٍ قديم.',
  },
  {
    id: 'p02',
    art: true,
    text: 'وفي ليلةٍ عاصفة، هبّت الريحُ على الكوخِ القديم.',
  },
  {
    id: 'p03',
    art: true,
    text: 'فسقطَ السقفُ… ولم يبقَ لهم بيتٌ يحميهم.',
  },
  {
    id: 'p04',
    art: true,
    text: 'قال الأكبر: لنبنِ بيتاً واحداً متيناً. لكنّهم اختلفوا.',
    // The horned brother is mid-sentence in the middle of the frame; the bubble
    // sits on the roof above him, which is the only large flat area left.
    bubbles: [
      { x: 610, y: 60, w: 300, text: 'لنبنِ بيتاً قوياً!', tail: [672, 420] },
    ],
  },
  {
    id: 'p05',
    art: true,
    text: 'الأصغرُ كان كسولاً، فجمع القشَّ وانتهى سريعاً.',
  },
  {
    id: 'p06',
    art: true,
    text: 'والأوسطُ جمع الحطبَ، وبنى بيته على عجل.',
  },
  {
    id: 'p07',
    art: true,
    text: 'أمّا الأكبرُ فبنى بالحجارةِ والطين، وأتقنَ عملَه.',
  },
  {
    id: 'p08',
    art: true,
    text: 'وذاتَ صباح، مرَّ ذئبٌ جائع.',
  },
  {
    id: 'p09',
    art: true,
    text: 'فطرقَ بابَ بيتِ القشّ.',
    // He is knocking at the centre of the frame and facing right, into the
    // door — so the bubble goes right of his head, the way he is speaking.
    bubbles: [
      { x: 1000, y: 66, w: 330, text: 'افتحِ البابَ أيها الخروف!', tail: [700, 400] },
    ],
    textAt: 'bl',
  },
  {
    id: 'p10',
    art: true,
    text: '',
    // The lamb is right of centre against the door; the roof over the room's
    // left half is empty, so the bubble goes there and reaches across.
    bubbles: [
      { x: 400, y: 46, w: 340, text: 'أنتَ أتيتَ لتأكلَني! لن أفتحَ لك!', tail: [650, 355] },
    ],
  },
  {
    id: 'p11',
    art: true,
    text: 'فنفخَ… وتطايرَ القشُّ في الهواء.',
  },
  {
    id: 'p12',
    art: true,
    text: 'هربَ الأصغرُ إلى بيتِ أخيه المصنوعِ من الحطب.',
  },
  {
    id: 'p13',
    art: true,
    text: '',
    // Two speakers: the lamb in the middle, his woolly brother on the right.
    // Their bubbles take opposite ends of the beam so the tails do not cross.
    bubbles: [
      { x: 1050, y: 40, w: 280, text: 'ما الذي يحدثُ؟', tail: [975, 300] },
      { x: 420, y: 40, w: 320, text: 'الذئبُ هدمَ بيتي!', tail: [660, 280] },
    ],
  },
  {
    id: 'p14',
    art: true,
    text: 'ثم وجدَ الذئبُ بيتَ الحطب، وطرقَ البابَ من جديد.',
  },
  {
    id: 'p15',
    art: true,
    text: 'ونفخَ نفخةً قوية… فسقطَ بيتُ الحطب.',
  },
  {
    id: 'p16',
    art: true,
    text: '',
    // The horned brother is the rightmost of the three and the one reassuring
    // the others.
    bubbles: [
      { x: 940, y: 56, w: 360, text: 'لا تخافا، بيتي متين!', tail: [880, 330] },
    ],
  },
  {
    id: 'p17',
    art: true,
    text: 'وصلَ الذئبُ إلى البيتِ المتين، وطرقَ بابَه.',
  },
  {
    id: 'p18',
    art: true,
    text: 'نفخَ… ونفخَ… ونفخ. لكنّ البيتَ لم يتزحزح.',
  },
  {
    id: 'p19',
    art: true,
    text: '',
    bubbles: [
      { x: 1000, y: 56, w: 300, text: 'عندي خطة…', tail: [980, 290] },
    ],
  },
  {
    id: 'p20',
    art: true,
    text: 'نزلَ الذئبُ من المدخنة… فاحترقَ ذيلُه!',
  },
  {
    id: 'p21',
    art: true,
    text: 'وهربَ يعدو في الغابةِ بعيداً، ولم يعُد.',
  },

  // ----------------------------------------------------------------- end
  {
    id: 'end',
    kind: 'moral',
    art: true,
    text: 'أتقِنْ عملَك… فالبيتُ المتينُ يحميكَ يوماً ما.',
  },
];
