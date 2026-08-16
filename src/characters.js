// Character registry. Moho exported each character with two views in one
// file, and the view group names are inconsistent between files (the wolf is
// "من_الامام", the sheep are "من_المام" — a typo that is baked into the art),
// so each character declares its own view IDs.
//
// Every character has BOTH views. The two younger sheep were registered with
// side: null early on and stayed that way for weeks — the art was there the
// whole time, so every shot that wanted them in profile was built around a
// limitation that did not exist.

const DIR = '/assets/incoming/خلفيات/شخصيات svg';

export const VIEW = { FRONT: 'front', SIDE: 'side' };

export const CHARACTERS = {
  wolf: {
    file: `${DIR}/ذيب.svg`,
    label: 'الذئب',
    views: { front: 'من_الامام', side: 'من_الجنب' },
  },
  big: {
    file: `${DIR}/الخروف الاكبر.svg`,
    label: 'الخروف الأكبر',
    views: { front: 'من_المام', side: 'من_الجمب' },
  },
  mid: {
    file: `${DIR}/الخروف الاوسط.svg`,
    label: 'الخروف الأوسط',
    views: { front: 'من_المام', side: 'من_الجمب' },
  },
  small: {
    file: `${DIR}/الخروف الاصغر.svg`,
    label: 'الخروف الأصغر',
    views: { front: 'من_المام', side: 'من_الجمب' },
  },
};
