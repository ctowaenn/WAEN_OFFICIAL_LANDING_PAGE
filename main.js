(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const introSection = $('s-intro');
  const introReveal = $('introReveal');
  const introOverlay = $('introOverlay');
  const nav = $('nav');
  const appSection = $('s-app');
  const appPhoneStack = document.querySelector('.app-phone-stack');
  const difSection = $('s-dif');

  let introMaxScroll = 1;
  let introComingLine = null;
  let introBrandRow = null;
  /** When true, intro progress comes from GSAP ScrollTrigger (smoothed scrub), not raw scroll. */
  let introDrivenByST = false;

  const clamp01 = (n) => Math.min(Math.max(n, 0), 1);
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  /** Softer, more “premium” scrub curve for the intro mask (less mechanical than cubic). */
  const easeInOutQuint = (t) =>
    t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;
  /** Settle / “luxury” ease — common in motion design for entrances (exponential decay). */
  const easeOutExpo = (t) => {
    const x = clamp01(t);
    return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
  };
  const easeOutCubic = (t) => 1 - Math.pow(1 - clamp01(t), 3);
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
      const dataUrl = await buildInvertedMaskDataUrl('assets/NN.png');
      document.documentElement.style.setProperty('--waenn-mask-url', `url("${dataUrl}")`);
    } catch {
      // If anything fails, degrade gracefully.
      document.documentElement.classList.add('no-mask');
    }
  }

  function recalcIntroMaxScroll() {
    if (!introSection) return;
    const vh = window.innerHeight;
    introMaxScroll = Math.max(introSection.offsetHeight - vh, 1);
  }

  function cacheIntroOverlayParts() {
    if (!introOverlay || introComingLine) return;
    introComingLine = introOverlay.querySelector('.intro-coming');
    introBrandRow = introOverlay.querySelector('.intro-brand');
  }

  function updateIntroFromProgress(pRaw) {
    if (!introSection || !introReveal) return;

    const p = clamp01(pRaw);
    const pe = easeInOutQuint(p);

    // Scale the mask from small → massive so the letters expand and then disappear.
    // Use vmin so it behaves consistently across aspect ratios.
    const start = 26; // vmin
    const end = 1200; // vmin (guarantee offscreen on ultrawide)
    const size = lerp(start, end, pe);
    introReveal.style.webkitMaskSize = `${size}vmin`;
    introReveal.style.maskSize = `${size}vmin`;
    if (introOverlay) {
      introOverlay.style.webkitMaskSize = `${size}vmin`;
      introOverlay.style.maskSize = `${size}vmin`;
    }

    // Cinematic crossfade — wider ranges so the hand-off feels smooth, not abrupt.
    const bgIn = smoothstep(0.68, 0.93, p);
    const maskOut = 1 - smoothstep(0.74, 0.97, p);
    const microZoom = lerp(1.0, 1.045, smoothstep(0.0, 1, p));

    document.documentElement.style.setProperty('--intro-bg-opacity', String(bgIn));
    document.documentElement.style.setProperty('--intro-bg-scale', String(microZoom));

    introReveal.style.opacity = String(maskOut);
    introReveal.style.transform = `scale(${microZoom})`;

    const reduceMotion =
      typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (introOverlay) {
      cacheIntroOverlayParts();

      // Whole block: quick ramp so stagger reads clearly; stays solid through the end.
      const shellIn = smoothstep(0.012, 0.09, p);
      introOverlay.style.opacity = String(shellIn);
      const driftPx = reduceMotion ? 0 : lerp(12, 0, easeInOutCubic(smoothstep(0, 0.38, p)));
      introOverlay.style.transform = `translate3d(0, ${driftPx}px, 0) scale(${microZoom})`;

      // “Coming soon”: blur → sharp, tracking tightens, slight rise + scale settle.
      if (introComingLine) {
        const vis = smoothstep(0.04, 0.27, p);
        const move = easeOutExpo(smoothstep(0, 0.36, p));
        const y = reduceMotion ? 0 : lerp(20, 0, move);
        const sc = reduceMotion ? 1 : lerp(0.96, 1, move);
        const blurCap =
          reduceMotion || (window.matchMedia && window.matchMedia('(max-width: 600px)').matches) ? 4 : 7;
        const blurPx = reduceMotion ? 0 : lerp(blurCap, 0, easeOutCubic(vis));
        const trackingEm = lerp(0.4, 0.18, easeInOutCubic(smoothstep(0, 0.52, p)));
        introComingLine.style.opacity = String(Math.min(1, vis * 0.94));
        introComingLine.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0) scale(${sc.toFixed(4)})`;
        introComingLine.style.letterSpacing = reduceMotion ? '' : `${trackingEm.toFixed(3)}em`;
        introComingLine.style.filter = blurPx > 0.04 ? `blur(${blurPx.toFixed(2)}px)` : 'none';
      }

      // Logo row: delayed stagger (motion-design overlap), gentler scale-up.
      if (introBrandRow) {
        const vis = smoothstep(0.11, 0.4, p);
        const move = easeOutExpo(smoothstep(0.06, 0.44, p));
        const y = reduceMotion ? 0 : lerp(26, 0, move);
        const sc = reduceMotion ? 1 : lerp(0.93, 1, move);
        introBrandRow.style.opacity = String(Math.min(1, vis * 0.98));
        introBrandRow.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0) scale(${sc.toFixed(4)})`;
      }
    }
  }

  function updateIntroFromScroll() {
    if (!introSection || !introReveal) return;
    const denom = Math.max(introMaxScroll, 1);
    updateIntroFromProgress(window.scrollY / denom);
  }

  /**
   * GSAP ScrollTrigger: scrub con inercia (mejor sensación que scroll 1:1).
   * Motion (ex-Framer Motion) no aplica aquí al ser HTML sin React.
   */
  function initIntroScrollEngine() {
    if (!introSection || typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
      return false;
    }
    gsap.registerPlugin(ScrollTrigger);
    const reduce =
      typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scrub = reduce ? 0 : 0.85;

    const st = ScrollTrigger.create({
      id: 'intro-pin-scrub',
      trigger: introSection,
      start: 'top top',
      end: 'bottom bottom',
      scrub,
      onUpdate: (self) => {
        updateIntroFromProgress(self.progress);
      },
    });
    updateIntroFromProgress(st.progress);
    return true;
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

    // Mobile: keep the "zoom-in" effect, but cap it so the phone
    // doesn't overflow the viewport and feel comically large.
    const isMobile = window.matchMedia && window.matchMedia('(max-width: 600px)').matches;
    const minScale = isMobile ? 0.82 : 0.88;
    const maxScale = isMobile ? 1.45 : 2.6;
    const scale = minScale + p * (maxScale - minScale);
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

    const navH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 72;
    const darkSections = [difSection, $('s-vision'), $('s-footer')];
    let overDark = false;
    for (const sec of darkSections) {
      if (!sec) continue;
      const r = sec.getBoundingClientRect();
      if (r.top < navH && r.bottom > 0) overDark = true;
    }

    nav.classList.toggle('dark', isDark || overDark);
  }

  let rafPending = false;
  function onScroll() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      if (!introDrivenByST) updateIntroFromScroll();
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

  function initHeroCtaSwitch() {
    const row = document.querySelector('[data-hero-cta-switch]');
    if (!row) return;

    const track = row.querySelector('.hero-cta-switch');
    const thumb = row.querySelector('.hero-cta-thumb');
    const segs = Array.from(row.querySelectorAll('.hero-cta-seg'));
    if (!track || !thumb || segs.length === 0) return;

    // Default state on page load is always "UNIRME A LA LISTA" (index 0),
    // but after clicking, we remember the last pressed segment until refresh.
    let active = 0;
    let hover = null;
    let focus = null;

    const displayed = () => {
      if (hover !== null) return hover;
      if (focus !== null) return focus;
      return active;
    };

    function layout() {
      const idx = displayed();
      const seg = segs[idx];
      if (!seg) return;

      track.dataset.focus = String(idx);

      const tr = track.getBoundingClientRect();
      const sr = seg.getBoundingClientRect();
      thumb.style.left = `${sr.left - tr.left}px`;
      thumb.style.top = `${sr.top - tr.top}px`;
      thumb.style.width = `${sr.width}px`;
      thumb.style.height = `${sr.height}px`;
    }

    segs.forEach((seg, i) => {
      seg.addEventListener('mouseenter', () => {
        hover = i;
        layout();
      });
      seg.addEventListener('pointerdown', () => {
        active = i;
        layout();
      });
    });

    track.addEventListener('mouseleave', () => {
      hover = null;
      layout();
    });

    track.addEventListener('focusin', (e) => {
      const seg = e.target.closest('.hero-cta-seg');
      focus = seg && segs.includes(seg) ? segs.indexOf(seg) : null;
      layout();
    });

    track.addEventListener('focusout', () => {
      window.setTimeout(() => {
        if (!track.contains(document.activeElement)) focus = null;
        layout();
      }, 0);
    });

    window.addEventListener('hashchange', layout);

    const ro = new ResizeObserver(() => layout());
    ro.observe(track);

    window.addEventListener('resize', layout, { passive: true });

    layout();
    requestAnimationFrame(() => {
      layout();
      track.classList.add('hero-cta-switch--ready');
    });
  }

  function initMobileDock() {
    const dock = $('mobileDock');
    const toggle = $('mobileDockToggle');
    const panel = $('mobileDockPanel');
    const backdrop = $('mobileDockBackdrop');
    if (!dock || !toggle || !panel || !backdrop) return;

    const mq = window.matchMedia('(max-width: 900px)');
    const sectionIds = ['s-marca', 's-dif', 's-vision', 's-access'];
    const sections = sectionIds.map((id) => $(id)).filter(Boolean);
    const links = Array.from(document.querySelectorAll('[data-mobile-dock-section]'));

    function dockToggleAriaLabel(isOpen) {
      try {
        if (typeof i18next !== 'undefined' && i18next.t) {
          const key = isOpen ? 'mobileDock.menuClose' : 'mobileDock.menuOpen';
          const s = i18next.t(key);
          if (s && s !== key) return s;
        }
      } catch {
        /* ignore */
      }
      return isOpen ? 'Cerrar menú de secciones' : 'Abrir menú de secciones';
    }

    function syncToggleAriaFromState() {
      const isOpen = dock.classList.contains('mobile-dock--open');
      toggle.setAttribute('aria-label', dockToggleAriaLabel(isOpen));
    }

    function setActiveById(id) {
      links.forEach((l) => {
        l.classList.toggle('is-active', l.getAttribute('data-mobile-dock-section') === id);
      });
    }

    function setOpen(open) {
      dock.classList.toggle('mobile-dock--open', open);
      document.body.classList.toggle('mobile-dock--expanded', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', dockToggleAriaLabel(open));
      panel.setAttribute('aria-hidden', open ? 'false' : 'true');
      if ('inert' in panel) panel.inert = !open;
      backdrop.setAttribute('aria-hidden', open ? 'false' : 'true');
      if (open) {
        requestAnimationFrame(() => {
          const first = panel.querySelector('a.mobile-dock__link');
          if (first) first.focus({ preventScroll: true });
        });
      }
    }

    function close() {
      setOpen(false);
    }

    toggle.addEventListener('click', () => {
      setOpen(!dock.classList.contains('mobile-dock--open'));
    });
    backdrop.addEventListener('click', () => {
      close();
      toggle.focus();
    });

    links.forEach((a) => {
      a.addEventListener('click', () => {
        window.setTimeout(close, 320);
      });
    });

    window.addEventListener('i18n:ready', syncToggleAriaFromState);
    window.addEventListener('i18n:updated', syncToggleAriaFromState);

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!dock.classList.contains('mobile-dock--open')) return;
      e.preventDefault();
      close();
      toggle.focus();
    });

    function applyHashActive() {
      const raw = (location.hash || '').replace(/^#/, '');
      if (sectionIds.includes(raw)) setActiveById(raw);
    }

    window.addEventListener('hashchange', applyHashActive);

    if (sections.length && links.length && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((e) => e.isIntersecting && e.intersectionRatio >= 0.2)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
          if (!visible.length) return;
          const id = visible[0].target.id;
          if (sectionIds.includes(id)) setActiveById(id);
        },
        { threshold: [0.2, 0.35, 0.5], rootMargin: '-22% 0px -38% 0px' }
      );
      sections.forEach((s) => io.observe(s));
    }

    function onMqChange() {
      if (!mq.matches) close();
    }
    mq.addEventListener('change', onMqChange);
    onMqChange();
    applyHashActive();
    syncToggleAriaFromState();
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
      const t = typeof window.i18nT === 'function' ? window.i18nT : (k) => k;
      const orig = btn.textContent;
      btn.textContent = t('form.success');
      btn.style.background = 'rgba(200,16,46,0.12)';
      btn.style.borderColor = 'rgba(200,16,46,0.4)';
      btn.style.color = '#c8102e';
      setTimeout(() => {
        btn.textContent = t('form.submit');
        btn.removeAttribute('style');
      }, 4000);
    });
  }

  function startApp() {
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener(
      'resize',
      () => {
        recalcIntroMaxScroll();
        if (introDrivenByST && typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
        onScroll();
      },
      { passive: true }
    );
    window.addEventListener('load', () => {
      recalcIntroMaxScroll();
      if (introDrivenByST && typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
      onScroll();
    });

    (async () => {
      recalcIntroMaxScroll();
      initRevealObserver();
      initHeroCtaSwitch();
      initMobileDock();
      initFormFallback();
      await initIntroMask();
      recalcIntroMaxScroll();
      introDrivenByST = initIntroScrollEngine();
      if (!introDrivenByST) updateIntroFromScroll();
      if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
      onScroll();
    })();
  }

  if (window.i18nReady) startApp();
  else window.addEventListener('i18n:ready', startApp, { once: true });
})();
