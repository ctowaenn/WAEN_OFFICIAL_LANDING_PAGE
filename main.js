(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const introSection = $('s-intro');
  const introReveal = $('introReveal');
  const nav = $('nav');
  const appSection = $('s-app');
  const appPhoneStack = document.querySelector('.app-phone-stack');
  const difSection = $('s-dif');

  const clamp01 = (n) => Math.min(Math.max(n, 0), 1);
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const smoothstep = (edge0, edge1, x) => {
    const t = clamp01((x - edge0) / Math.max(edge1 - edge0, 1e-6));
    return t * t * (3 - 2 * t);
  };

  function supportsMask() {
    return (
      (window.CSS && CSS.supports && (CSS.supports('mask-image', 'url("x")') || CSS.supports('-webkit-mask-image', 'url("x")'))) ||
      false
    );
  }

  async function buildInvertedMaskDataUrl(imageUrl) {
    const img = new Image();
    img.decoding = 'async';
    img.crossOrigin = 'anonymous';

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = imageUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas context not available');

    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imageData.data;

    // Invert RGB so the black letters become white (visible area in luminance masks).
    for (let i = 0; i < d.length; i += 4) {
      d[i + 0] = 255 - d[i + 0];
      d[i + 1] = 255 - d[i + 1];
      d[i + 2] = 255 - d[i + 2];
      // keep alpha
    }
    ctx.putImageData(imageData, 0, 0);

    return canvas.toDataURL('image/png');
  }

  async function initIntroMask() {
    if (!introSection || !introReveal) return;

    if (!supportsMask()) {
      document.documentElement.classList.add('no-mask');
      return;
    }

    try {
      // Use the reveal image as background too, so the end state is the full photo.
      document.documentElement.style.setProperty('--intro-bg-url', `url("${introReveal.currentSrc || introReveal.src}")`);
      const dataUrl = await buildInvertedMaskDataUrl('assets/waenn_logo.jpeg');
      document.documentElement.style.setProperty('--waenn-mask-url', `url("${dataUrl}")`);
    } catch {
      // If anything fails, degrade gracefully.
      document.documentElement.classList.add('no-mask');
    }
  }

  function updateIntro() {
    if (!introSection || !introReveal) return;

    const vh = window.innerHeight;
    const maxScroll = introSection.offsetHeight - vh;
    const p = clamp01(window.scrollY / Math.max(maxScroll, 1));
    const pe = easeInOutCubic(p);

    // Scale the mask from small → massive so the letters expand and then disappear.
    // Use vmin so it behaves consistently across aspect ratios.
    const start = 26; // vmin
    const end = 1200; // vmin (guarantee offscreen on ultrawide)
    const size = lerp(start, end, pe);
    introReveal.style.webkitMaskSize = `${size}vmin`;
    introReveal.style.maskSize = `${size}vmin`;

    // Cinematic crossfade into the full background image.
    // By the time we reach the end, you see the full photo (not black).
    const bgIn = smoothstep(0.78, 0.95, p);
    const maskOut = 1 - smoothstep(0.82, 0.98, p);
    const microZoom = lerp(1.0, 1.06, smoothstep(0.0, 0.95, p));

    document.documentElement.style.setProperty('--intro-bg-opacity', String(bgIn));
    document.documentElement.style.setProperty('--intro-bg-scale', String(microZoom));

    introReveal.style.opacity = String(maskOut);
    introReveal.style.transform = `scale(${microZoom})`;
  }

  function updateApp() {
    if (!appSection) return;
    const phones = Array.from(document.querySelectorAll('.app-phone'));
    if (phones.length === 0) return;
    const vh = window.innerHeight;
    const rect = appSection.getBoundingClientRect();
    const sectionH = appSection.offsetHeight;

    const raw = 1 - rect.bottom / (sectionH + vh);
    const p = Math.min(Math.max(raw, 0), 1);

    const scale = 0.88 + p * 1.72;
    let opacity = 1;
    if (p < 0.1) opacity = p / 0.1;
    else if (p > 0.8) opacity = 1 - (p - 0.8) / 0.2;

    for (const phone of phones) {
      phone.style.transform = `scale(${scale})`;
      phone.style.opacity = String(opacity);
    }

    // Swap active mockup as you scroll through the app section.
    // (Replace the duplicated placeholders with real assets whenever.)
    if (appPhoneStack) {
      const idx = Math.min(phones.length - 1, Math.floor(p * phones.length));
      phones.forEach((el, i) => el.classList.toggle('is-active', i === idx));
    }
  }

  function updateNav() {
    if (!introSection || !nav) return;
    const introH = introSection.offsetHeight;
    const vh = window.innerHeight;
    const isDark = window.scrollY > introH - vh * 0.3;

    const darkSections = [difSection, $('s-vision'), $('s-footer')];
    let overDark = false;
    for (const sec of darkSections) {
      if (!sec) continue;
      const r = sec.getBoundingClientRect();
      if (r.top < 60 && r.bottom > 0) overDark = true;
    }

    nav.classList.toggle('dark', isDark || overDark);
  }

  let rafPending = false;
  function onScroll() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      updateIntro();
      updateApp();
      updateNav();
      rafPending = false;
    });
  }

  function initRevealObserver() {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('show');
          revealObserver.unobserve(entry.target);
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -48px 0px' }
    );

    document.querySelectorAll('.rv, .rv-fade').forEach((el) => revealObserver.observe(el));
  }

  function initFormFallback() {
    // If Brevo embed isn't installed yet, keep the original UX feedback.
    const form = $('access-form');
    if (!form) return;
    form.addEventListener('submit', (e) => {
      const usesBrevo = form.getAttribute('data-brevo') === 'true';
      if (usesBrevo) return;

      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      if (!btn) return;
      const orig = btn.textContent;
      btn.textContent = '¡ RECIBIDO — GRACIAS !';
      btn.style.background = 'rgba(200,16,46,0.12)';
      btn.style.borderColor = 'rgba(200,16,46,0.4)';
      btn.style.color = '#c8102e';
      setTimeout(() => {
        btn.textContent = orig;
        btn.removeAttribute('style');
      }, 4000);
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });

  (async () => {
    await initIntroMask();
    initRevealObserver();
    initFormFallback();
    onScroll();
  })();
})();
