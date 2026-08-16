// The project's own voice recordings, catalogued for the listening games.
//
// These are the actors' takes from assets/audio/صوتيات. Outside the teaser's
// four lines they were unused, and they are the best-performed asset in the
// project — a child hearing the real wolf try to talk his way through a door
// is worth more than any amount of drawn menace.
//
// `at`/`sec` trim a clip to its useful part: several takes open with a couple
// of seconds of room tone, and one runs fourteen seconds.

export const WOLF_LINES = [
  { file: 'المشهد العاشر/الذئب.mp3', at: 0, sec: 4.7,
    text: 'افتح أيها الخروف الصغير، دعني أرى بيتك من الداخل!' },
  { file: 'المشهد العاشر/الذئب 2.mp3', at: 0, sec: 3.5,
    text: 'لقد تعبتُ من الوقوف، لن يحدث شيء! افتح الباب!' },
  { file: 'المشهد الخامس عشر/الذئب.mp3', at: 0, sec: 6.0,
    text: 'أنا الذئب الطيب، أشعر بالبرد… دعوني أدخل!' },
  { file: 'التاسع عشر/الذئب.mp3', at: 0, sec: 5.5,
    text: 'افتحوا الباب قبل أن أدمّر البيت فوق رؤوسكم!' },
  { file: 'الحادي والعشرون/الذئب.mp3', at: 0, sec: 5.5,
    text: 'سأنفخ على بيتكم، ثم ألتهمكم جميعاً!' },
  { file: 'الثاني والعشرون/الذئب.mp3', at: 0, sec: 6.0,
    text: 'لا أريد التهامكم… أريد مكاناً أحتمي فيه فقط.' },
];

export const SHEEP_LINES = [
  { who: 'small', file: 'المشهد الثالث عشر/الخروف الاصغر-1.mp3', at: 0, sec: 5.2,
    text: 'الذئبُ هدمَ بيتي وهو يطاردني!' },
  { who: 'small', file: 'العشرون/الخروف الاصغر.mp3', at: 0, sec: 3.6,
    text: 'ارحمنا أيها الذئب!' },
  { who: 'mid', file: 'المشهد الرابع/الخروف الاوسط 1.mp3', at: 0, sec: 5.2,
    text: 'علينا إيجادُ منزلٍ يحمينا من البرد.' },
  { who: 'mid', file: 'المشهد الخامس عشر/الخروف الاوسط-1.mp3', at: 0, sec: 1.3,
    text: 'من يطرقُ الباب؟' },
  { who: 'big', file: 'الثاني والعشرون/الخروف الاكبر.mp3', at: 0, sec: 5.3,
    text: 'أيها الذئب، لن تستطيعَ التهامنا. ارحل!' },
  { who: 'big', file: 'الثامن عشر/الخروف الاكبر.mp3', at: 0, sec: 6.0,
    text: 'لا تقلقا، بيتي قويٌّ ومتين.' },
];

/** Deterministic shuffle so a round is reproducible from a seed. */
export function shuffle(list, seed = 1) {
  const a = list.slice();
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) % 4294967296;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
