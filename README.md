# الخراف الثلاثة والذئب الماكر

<div dir="rtl">

مشروع تخرّج — كلية فلسطين التقنية، دير البلح · الوسائط المتعددة والرسوم المتحركة

</div>

Poster, teaser, storybook and seven mini games built from the film's own Moho
artwork. Everything is plain ES modules and SVG — no framework, no bundler, no
build step for the games.

**▶ Play: https://khader-1.github.io/3-Sheeps/** — installable as an app
(Add to Home Screen) and playable offline once installed.

## The games

| | |
|---|---|
| 🏠 ابنِ بيتك | Pick a material and time the care meter before the wolf arrives |
| 🚪 لا تفتح الباب | Listen to who is knocking |
| 🏃 اهرب! | Jump the obstacles and reach your brother's house |
| 🔥 المدخنة | Light the fire at exactly the right moment |
| 🎧 من قال هذا؟ | Match the line to the character who said it |
| 🧩 أعِد البناء | Drag the pieces back into place, in a buildable order |
| 😀 كيف يشعر؟ | Read the face, name the feeling |

## Layout

```
src/rig.js           load Moho SVG exports and make them posable
src/base.js          resolve paths against the site root, wherever it is mounted
src/expressions.js   face maps, expression presets, the base-pose layer
src/anim/            timeline, gait, idle, lip sync, stage + camera
src/game/            the seven games, the menu, and the responsive UI core
src/book/            storybook pages and effects
src/targets/         poster, teaser, book, inspection renders
tools/               renderers, audio mixing, TTS, music, PWA packaging
assets/incoming/     the Moho projects and their SVG exports (source art)
assets/audio/        recorded voices, generated sound effects
index.html           the games — the site entry point
web/                 secondary pages and the app icons
```

## Running it

```sh
npm install            # puppeteer-core, for the renderers only
node tools/serve.mjs   # http://127.0.0.1:8787/
```

The games need nothing but a static server. The render pipeline drives headless
Chrome:

```sh
node tools/build.mjs poster     # out/poster.{svg,png}
node tools/book.mjs             # out/book.html
node tools/render.mjs promo     # out/promo.mp4
node tools/icons.mjs            # app icons, cut from the artwork
node tools/pwa.mjs              # manifest and service worker
node tools/site.mjs             # assemble dist/ for deployment
```

`out/` is not tracked — every file in it is regenerated from what is.

## Credits

Artwork and voice recordings by the project team. Arabic type is
[Baloo Bhaijaan 2](https://fonts.google.com/specimen/Baloo+Bhaijaan+2) (titles)
and [Cairo](https://fonts.google.com/specimen/Cairo) (text), both SIL OFL,
subset and embedded by `tools/fonts.mjs`.
