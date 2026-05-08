(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const introSection = $('s-intro');
  const introReveal = $('introReveal');
  const nav = $('nav');
  const appSection = $('s-app');
  const appPhone = $('appPhone');
  const difSection = $('s-dif');

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
    const p = Math.min(Math.max(window.scrollY / Math.max(maxScroll, 1), 0), 1);

    // Scale the mask from small → massive so the letters expand and then disappear.
    // Use vmin so it behaves consistently across aspect ratios.
    const start = 32; // vmin
    const end = 900; // vmin (effectively exits viewport)
    const size = start + (end - start) * p;
    introReveal.style.webkitMaskSize = `${size}vmin`;
    introReveal.style.maskSize = `${size}vmin`;

    // Hard-cut near the end to guarantee hero reveals without a lingering edge.
    introReveal.style.opacity = p > 0.92 ? '0' : '1';
  }

  function updateApp() {
    if (!appSection || !appPhone) return;
    const vh = window.innerHeight;
    const rect = appSection.getBoundingClientRect();
    const sectionH = appSection.offsetHeight;

    const raw = 1 - rect.bottom / (sectionH + vh);
    const p = Math.min(Math.max(raw, 0), 1);

    const scale = 0.88 + p * 1.72;
    let opacity = 1;
    if (p < 0.1) opacity = p / 0.1;
    else if (p > 0.8) opacity = 1 - (p - 0.8) / 0.2;

    appPhone.style.transform = `scale(${scale})`;
    appPhone.style.opacity = String(opacity);
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
