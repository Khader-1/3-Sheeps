// Corrected Arabic copy.
//
// The source poster stored every string in *visual* order (already reversed),
// which the renderer then reversed again — so the title read «ةثلثلا فارخلا».
// Reversing also destroyed every lam-alef ligature, collapsing لا to a bare ل:
//   الثلاثة -> الثلثة      الأبعاد -> البعاد      لا ينجو إلا -> ل ينجو إل
//
// These strings are written in correct logical order with the ligatures
// restored; the browser handles shaping and bidi.

export const COPY = {
  titleLine1: 'الخراف الثلاثة',
  titleLine2: 'والذئب الماكر',
  subtitle: 'فيلم رسوم متحركة ثنائي الأبعاد',
  tagline: 'حين يطرق الذئب الباب، لا ينجو إلا البيت المتين',

  // Teaser cards. Each one lands in a gap between voice lines, so text and
  // dialogue never compete — see the beat map in src/targets/promo.js.
  // They set atmosphere without naming a material or showing an outcome.
  teaser: {
    calm: 'في قريةٍ هادئة',
    brothers: 'ثلاثةُ إخوة… وثلاثةُ بيوت',
    knock: 'ثم طُرِقَ الباب',
    lurking: 'شيءٌ ما يتربّص',
    wolf: 'ذئبٌ جائع',
    question: 'فمن يصمدُ حين يُطرَقُ الباب؟',
    soon: 'قريبًا',
  },

  credits: [
    'كلية فلسطين التقنية – دير البلح · قسم الحاسوب',
    'تخصص الوسائط المتعددة والرسوم المتحركة',
    'إعداد: فايز أحمد الحسنات · براء عمر الحسنات · محمد فايز الزيتي',
    'أحمد محمد خضير · طارق جميل نصار · يوسف حسن أبو عيطة',
    'إشراف: م. منال حجازي · مارس 2026',
  ],
};
