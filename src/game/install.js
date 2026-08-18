// The "add this to your home screen" card.
//
// Two platforms, two completely different mechanics behind one button:
//
//   Android / desktop Chrome  the browser fires beforeinstallprompt, we stash
//                             the event, and تثبيت calls prompt() on it. A real
//                             one-tap install.
//   iOS Safari                there is no install API at all. Apple only offers
//                             Share -> Add to Home Screen, so تثبيت can do
//                             nothing but show where those two taps are.
//
// Which is why this is a card and not a button: on the platform that most needs
// it, instructions are the only thing on offer.
//
// It is plain DOM rather than SVG. The games draw into an <svg> that rescales
// with the viewport, and a dialog should not be part of that scene — it wants
// to sit above everything at a fixed size, and it has to reach outside the
// stage to point at Safari's own toolbar.

const KEY = 'sheeps.install.dismissed';
const SNOOZE_DAYS = 7;

/** Already installed? Then there is nothing to offer. */
function installed() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    // iOS predates display-mode and reports it here instead.
    navigator.standalone === true;
}

function isIOS() {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ claims to be a Mac; the touch points give it away.
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/** iOS only offers Add to Home Screen in Safari itself, not in other browsers. */
function isIOSSafari() {
  const ua = navigator.userAgent;
  return isIOS() && !/CriOS|FxiOS|EdgiOS|OPiOS|Instagram|FBAN|FBAV|Line\//.test(ua);
}

function snoozed() {
  const at = Number(localStorage.getItem(KEY) || 0);
  return at > 0 && Date.now() - at < SNOOZE_DAYS * 864e5;
}

const css = `
.ins-scrim {
  position: fixed; inset: 0; z-index: 60; display: grid; place-items: center;
  background: rgba(8, 5, 2, .62); backdrop-filter: blur(3px);
  padding: max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom));
  animation: ins-fade .22s ease-out both;
}
@keyframes ins-fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes ins-rise { from { opacity: 0; transform: translateY(14px) scale(.97) } to { opacity: 1; transform: none } }
.ins-card {
  width: min(400px, 100%); max-height: 100%; overflow: auto;
  background: #FFF6DC; color: #2a1608; border: 5px solid #2a1608; border-radius: 26px;
  padding: 22px 22px 18px; text-align: center; box-shadow: 0 18px 40px rgba(0,0,0,.45);
  animation: ins-rise .26s cubic-bezier(.2,.9,.3,1.2) both;
}
.ins-card img { width: 84px; height: 84px; display: block; margin: 0 auto 10px; }
.ins-card h2 { margin: 0 0 6px; font-size: 25px; font-weight: 800; line-height: 1.3; }
.ins-card p { margin: 0 0 16px; font-size: 16px; line-height: 1.65; opacity: .82; }
.ins-btn {
  display: block; width: 100%; margin-top: 9px; padding: 13px 18px;
  font-family: inherit; font-size: 19px; font-weight: 800; cursor: pointer;
  border-radius: 15px; border: 4px solid #2a1608;
}
.ins-go { background: #7ac043; color: #14260a; }
.ins-later { background: transparent; color: #2a1608; opacity: .7; border-color: transparent; font-size: 17px; }
.ins-btn:active { transform: translateY(1px); }
/* The two-step Safari walkthrough. */
.ins-steps { text-align: start; margin: 0 0 4px; padding: 0; list-style: none; }
.ins-steps li {
  display: flex; align-items: center; gap: 11px; font-size: 17px; line-height: 1.5;
  padding: 11px 13px; margin-bottom: 9px; background: #fffdf4;
  border: 3px solid rgba(42,22,8,.18); border-radius: 14px;
}
.ins-steps b { font-weight: 800; }
.ins-num {
  flex: none; width: 27px; height: 27px; border-radius: 50%; background: #2a1608; color: #FFF6DC;
  font-size: 15px; font-weight: 800; display: grid; place-items: center;
}
.ins-gl { flex: none; width: 26px; height: 26px; }
/* Safari puts its toolbar at the bottom on a phone and the top on a tablet. */
.ins-point { font-size: 15px; opacity: .72; margin: 2px 0 12px; }
`;

const SHARE_ICON = `<svg class="ins-gl" viewBox="0 0 24 24" fill="none" stroke="#0a84ff" stroke-width="1.9"
  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M12 15V3.5"/><path d="m8.5 7 3.5-3.5L15.5 7"/>
  <path d="M6 11.5H5a1.5 1.5 0 0 0-1.5 1.5v6A1.5 1.5 0 0 0 5 20.5h14a1.5 1.5 0 0 0 1.5-1.5v-6a1.5 1.5 0 0 0-1.5-1.5h-1"/>
</svg>`;

const PLUS_ICON = `<svg class="ins-gl" viewBox="0 0 24 24" fill="none" stroke="#2a1608" stroke-width="1.9"
  stroke-linecap="round" aria-hidden="true">
  <rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><path d="M12 8.5v7M8.5 12h7"/>
</svg>`;

/**
 * Offer to install, once the player has had a moment to see what the app is.
 * @param {object} [o]
 * @param {number} [o.delay] ms to wait before asking
 */
export function initInstallPrompt({ delay = 2500 } = {}) {
  // Inside the project deck the games run in an iframe; an install card there
  // is offering to install a page the viewer is not really on.
  if (new URLSearchParams(location.search).has('embed')) return;
  if (installed() || snoozed()) return;

  let deferred = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    // Chrome would otherwise show its own mini-infobar; take it over so the
    // ask matches the rest of the game.
    e.preventDefault();
    deferred = e;
  });

  // Nothing to offer on a desktop browser that never fires the event and has
  // no Add to Home Screen either.
  const eligible = () => deferred || isIOSSafari();

  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const dismiss = (scrim) => {
    localStorage.setItem(KEY, String(Date.now()));
    scrim.remove();
  };

  function show() {
    if (installed() || !eligible() || document.querySelector('.ins-scrim')) return;

    const scrim = document.createElement('div');
    scrim.className = 'ins-scrim';
    const card = document.createElement('div');
    card.className = 'ins-card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    scrim.appendChild(card);

    const ask = () => {
      card.innerHTML = `
        <img src="web/icons/icon-192.png" alt="">
        <h2>ثبِّت اللعبة على جهازك</h2>
        <p>تُفتح مباشرة من الشاشة الرئيسية، وتعمل بدون إنترنت.</p>
        <button class="ins-btn ins-go">تثبيت</button>
        <button class="ins-btn ins-later">لاحقاً</button>`;
      card.querySelector('.ins-go').onclick = async () => {
        if (deferred) {
          deferred.prompt();
          const { outcome } = await deferred.userChoice;
          deferred = null;
          if (outcome === 'accepted') scrim.remove();
          else dismiss(scrim);
          return;
        }
        steps();   // iOS: all we can do is point at the Share sheet
      };
      card.querySelector('.ins-later').onclick = () => dismiss(scrim);
    };

    const steps = () => {
      // iPhones put the Safari toolbar at the bottom; iPads at the top.
      const atBottom = Math.min(window.innerWidth, window.innerHeight) < 700;
      card.innerHTML = `
        <h2>خطوتان فقط</h2>
        <ul class="ins-steps">
          <li><span class="ins-num">١</span><span>اضغط زر <b>المشاركة</b></span>${SHARE_ICON}</li>
          <li><span class="ins-num">٢</span><span>اختر <b>إضافة إلى الشاشة الرئيسية</b></span>${PLUS_ICON}</li>
        </ul>
        <p class="ins-point">${atBottom
          ? 'زر المشاركة في شريط سفاري بالأسفل ↓'
          : 'زر المشاركة في شريط سفاري بالأعلى ↑'}</p>
        <button class="ins-btn ins-later">تم</button>`;
      card.querySelector('.ins-later').onclick = () => dismiss(scrim);
    };

    ask();
    document.body.appendChild(scrim);
  }

  // Chrome fires beforeinstallprompt shortly after load, so give it a chance
  // to arrive before deciding there is nothing to offer.
  setTimeout(show, delay);

  window.addEventListener('appinstalled', () => {
    localStorage.setItem(KEY, String(Date.now()));
    document.querySelector('.ins-scrim')?.remove();
  });
}
