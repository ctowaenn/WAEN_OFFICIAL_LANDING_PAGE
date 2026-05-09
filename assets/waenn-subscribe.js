/* WAENN — waenn-subscribe (Brevo): pasos nombre → email → intereses + carrito SVG */
(function () {
  'use strict';

  const sAccessEarly = document.getElementById('s-access');
  const providerRaw = sAccessEarly && sAccessEarly.getAttribute('data-access-provider');
  const providerNorm = providerRaw ? String(providerRaw).toLowerCase() : '';
  if (sAccessEarly && providerNorm === 'brevo-iframe') return;

  if (!document.getElementById('access-experience')) return;

  const IS_PLAYGROUND = Boolean(document.getElementById('ws-playground-live'));

  const INTERESTS = [
    { value: 'Identity and character', labelKey: 'form.optIdentidad' },
    { value: 'Longevity and quality', labelKey: 'form.optPermanencia' },
    { value: 'A fit that truly works', labelKey: 'form.optFit' },
  ];

  const BREVO_CACHE_KEY = 'waenn:brevoAction';
  const BREVO_CACHE_TTL_MS = 30 * 60 * 1000;
  const BREVO_FETCH_TIMEOUT_MS = 9000;

  let brevoLoaderInflight = null;
  let brevoLoaderFailed = false;
  let currentStep = 1;
  let cartBusyDelayTimer = null;

  function getCartBase() {
    const h = document.documentElement.getAttribute('data-cart-base');
    if (h !== null && h !== undefined) return h;
    const el = document.getElementById('access-experience');
    return (el && el.getAttribute('data-cart-base')) || '';
  }

  function t(key, dict) {
    if (!dict) return key;
    const parts = key.split('.');
    let o = dict;
    for (let i = 0; i < parts.length; i++) {
      o = o && o[parts[i]];
    }
    return typeof o === 'string' ? o : key;
  }

  function Tkey(key) {
    if (i18nDict) return t(key, i18nDict);
    if (typeof window.i18nT === 'function') {
      const v = window.i18nT(key);
      if (v && v !== key) return v;
    }
    return key;
  }

  function isValidBrevoAction(url) {
    if (!url || typeof url !== 'string') return false;
    try {
      const u = new URL(url);
      if (u.protocol !== 'https:') return false;
      if (!/(^|\.)sibforms\.com$/i.test(u.host)) return false;
      if (!u.pathname.startsWith('/serve/')) return false;
      return true;
    } catch {
      return false;
    }
  }

  function readBrevoCache() {
    try {
      const raw = sessionStorage.getItem(BREVO_CACHE_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || typeof obj.url !== 'string' || typeof obj.ts !== 'number') return null;
      if (Date.now() - obj.ts > BREVO_CACHE_TTL_MS) return null;
      if (!isValidBrevoAction(obj.url)) return null;
      return obj.url;
    } catch {
      return null;
    }
  }

  function writeBrevoCache(url) {
    try {
      sessionStorage.setItem(BREVO_CACHE_KEY, JSON.stringify({ url, ts: Date.now() }));
    } catch {
      /* ignore */
    }
  }

  async function loadBrevoActionUrl() {
    if (brevoLoaderFailed) return null;
    const cached = readBrevoCache();
    if (cached) return cached;
    if (brevoLoaderInflight) return brevoLoaderInflight;

    const base = getCartBase();
    brevoLoaderInflight = (async () => {
      try {
        const res = await fetch(base + 'iframe.html', { cache: 'no-cache', credentials: 'omit' });
        if (!res.ok) throw new Error('iframe.html ' + res.status);
        const html = await res.text();
        const wrapped =
          '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>' +
          html.trim() +
          '</body></html>';
        const doc = new DOMParser().parseFromString(wrapped, 'text/html');
        const ifr = doc.querySelector('iframe[src*="sibforms.com/serve/"], iframe[src*="sibforms.com"]');
        const action = ifr && (ifr.getAttribute('src') || '').trim();
        if (!isValidBrevoAction(action)) throw new Error('invalid iframe src');
        writeBrevoCache(action);
        return action;
      } catch (err) {
        console.warn('[waenn-subscribe brevo]', err);
        brevoLoaderFailed = true;
        return null;
      } finally {
        brevoLoaderInflight = null;
      }
    })();
    return brevoLoaderInflight;
  }

  let i18nDict = null;
  let i18nLang = 'es';

  async function loadI18n(lang) {
    const base = getCartBase();
    const res = await fetch(base + 'locales/' + lang + '/translation.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('locale ' + res.status);
    i18nDict = await res.json();
    i18nLang = lang;
    document.documentElement.lang = lang;
    applyI18nToDom();
  }

  function applyI18nToDom() {
    if (!i18nDict) return;
    document.querySelectorAll('[data-i18n-key]').forEach(function (el) {
      const k = el.getAttribute('data-i18n-key');
      if (k) el.textContent = t(k, i18nDict);
    });
    document.querySelectorAll('[data-i18n-placeholder-key]').forEach(function (el) {
      const k = el.getAttribute('data-i18n-placeholder-key');
      if (k && el.setAttribute) el.setAttribute('placeholder', t(k, i18nDict));
    });
    document.querySelectorAll('[data-i18n-aria-label]').forEach(function (el) {
      const k = el.getAttribute('data-i18n-aria-label');
      if (k && el.setAttribute) {
        const v = t(k, i18nDict);
        if (v && v !== k) el.setAttribute('aria-label', v);
      }
    });
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  const cartSet = new Set();
  const shelf = document.getElementById('ws-shelf');
  const chipsHost = document.getElementById('access-cart-chips');
  const cartBtn = document.getElementById('ws-cart-btn');
  const dropTarget = document.getElementById('ws-drop-target');
  const cartZoneCaption = document.getElementById('ws-cart-zone-caption');
  const cartStatus = document.getElementById('access-cart-status');
  const cartCount = document.getElementById('access-cart-count');
  const form = document.getElementById('access-form');
  const localeEl = document.getElementById('f-locale');
  const liveToggle = document.getElementById('ws-playground-live');
  const stepHint = document.getElementById('ws-step-hint');
  const wrapName = document.getElementById('ws-step-wrap-name');
  const wrapEmail = document.getElementById('ws-step-wrap-email');
  const wrapInterests = document.getElementById('ws-step-wrap-interests');
  const consentBlock = document.getElementById('ws-consent-block');
  const btnNameNext = document.getElementById('ws-btn-name-next');
  const btnEmailNext = document.getElementById('ws-btn-email-next');
  const interestsHelpBtn = document.getElementById('ws-interests-help-btn');
  const interestsHelpPop = document.getElementById('ws-interests-help-pop');

  function setInterestsHelpOpen(open) {
    if (!interestsHelpBtn || !interestsHelpPop) return;
    interestsHelpBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) interestsHelpPop.removeAttribute('hidden');
    else interestsHelpPop.setAttribute('hidden', '');
  }

  function closeInterestsHelpPopover() {
    setInterestsHelpOpen(false);
  }

  function wireInterestsHelp() {
    if (!interestsHelpBtn || !interestsHelpPop) return;
    interestsHelpBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      const open = interestsHelpBtn.getAttribute('aria-expanded') === 'true';
      setInterestsHelpOpen(!open);
    });
    document.addEventListener('click', function (e) {
      if (interestsHelpPop.hasAttribute('hidden')) return;
      const t = e.target;
      if (interestsHelpBtn.contains(t) || interestsHelpPop.contains(t)) return;
      closeInterestsHelpPopover();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeInterestsHelpPopover();
    });
  }

  wireInterestsHelp();

  function syncLocaleField() {
    if (!localeEl) return;
    if (IS_PLAYGROUND) {
      localeEl.value = i18nLang === 'en' ? 'en' : 'es';
      return;
    }
    try {
      const raw =
        typeof i18next !== 'undefined' && (i18next.resolvedLanguage || i18next.language)
          ? i18next.resolvedLanguage || i18next.language
          : 'es';
      const lang = String(raw).toLowerCase().split('-')[0];
      localeEl.value = lang === 'en' ? 'en' : 'es';
    } catch {
      localeEl.value = 'es';
    }
  }

  function syncInterestCheckboxes() {
    if (!form) return;
    form.querySelectorAll('input[type="checkbox"][name="PRENDA_INTERES[]"]').forEach(function (cb) {
      cb.checked = cartSet.has(cb.value);
    });
  }

  function syncInterestGate() {
    const g = document.getElementById('access-interest-gate');
    if (!g) return;
    g.setCustomValidity(cartSet.size < 1 ? Tkey('accessGame.validationInterest') : '');
  }

  function renderMiniChips() {
    if (!chipsHost) return;
    chipsHost.textContent = '';
    cartSet.forEach(function (val) {
      const s = document.createElement('span');
      s.className = 'ws-mini-tag';
      s.tabIndex = 0;
      s.textContent = shortLabel(val);
      s.setAttribute('role', 'button');
      s.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        removeFromCart(val);
      });
      s.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          removeFromCart(val);
        }
      });
      chipsHost.appendChild(s);
    });
  }

  function shortLabel(value) {
    for (let i = 0; i < INTERESTS.length; i++) {
      if (INTERESTS[i].value === value) {
        const full = Tkey(INTERESTS[i].labelKey);
        return full.length > 22 ? full.slice(0, 20) + '…' : full;
      }
    }
    return value;
  }

  function updateCartUi() {
    const n = cartSet.size;
    if (cartCount) cartCount.textContent = String(n);
    const ready = n > 0 && currentStep === 3;
    if (cartBtn) {
      cartBtn.classList.toggle('ws-cart-btn--ready', ready);
      if (ready) {
        cartBtn.setAttribute('aria-label', Tkey('accessGame.cartSubmitCta'));
      } else {
        cartBtn.setAttribute('aria-label', Tkey('accessGame.cartAria'));
      }
    }
    if (cartStatus) {
      if (currentStep === 3 && n < 1) {
        cartStatus.textContent = Tkey('accessGame.cartNeedInterest');
      } else {
        cartStatus.textContent = n > 0 ? Tkey('accessGame.cartReady') : Tkey('accessGame.cartEmpty');
      }
    }
    syncInterestCheckboxes();
    syncInterestGate();
    renderMiniChips();
  }

  function findTagOnShelf(value) {
    if (!shelf) return null;
    const nodes = shelf.querySelectorAll('.ws-tag');
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].getAttribute('data-interest') === value) return nodes[i];
    }
    return null;
  }

  function insertTagInShelf(value) {
    if (!shelf) return;
    const item = INTERESTS.find(function (x) {
      return x.value === value;
    });
    if (!item) return;
    const idx = INTERESTS.findIndex(function (x) {
      return x.value === value;
    });
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'ws-tag';
    el.setAttribute('data-interest', item.value);
    el.setAttribute('aria-pressed', 'false');
    el.textContent = Tkey(item.labelKey);
    let inserted = false;
    for (let i = 0; i < shelf.children.length; i++) {
      const ch = shelf.children[i];
      const v = ch.getAttribute('data-interest');
      const j = INTERESTS.findIndex(function (x) {
        return x.value === v;
      });
      if (j > idx) {
        shelf.insertBefore(el, ch);
        inserted = true;
        break;
      }
    }
    if (!inserted) shelf.appendChild(el);
    el.setAttribute('title', Tkey('accessGame.tagDragTitle'));
    wireInterestPointer(el, item.value);
  }

  function addToCart(value) {
    if (cartSet.has(value)) return;
    cartSet.add(value);
    const tag = findTagOnShelf(value);
    if (tag) tag.remove();
    updateCartUi();
  }

  function removeFromCart(value) {
    cartSet.delete(value);
    if (!findTagOnShelf(value)) insertTagInShelf(value);
    updateCartUi();
  }

  function toggleCart(value) {
    if (cartSet.has(value)) removeFromCart(value);
    else addToCart(value);
  }

  const dragState = {
    active: false,
    value: null,
    source: null,
    clone: null,
    sx: 0,
    sy: 0,
    ox: 0,
    oy: 0,
    moved: false,
    pid: 0,
  };

  function pointInRect(x, y, r) {
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }

  function setDropTargetActive(on) {
    if (dropTarget) dropTarget.classList.toggle('ws-drop-target--active', !!on);
  }

  function clearProfileSlots() {
    const host = document.getElementById('ws-profile-slots');
    if (host) host.textContent = '';
  }

  function truncateProfileDisplay(s, max) {
    max = max || 26;
    s = String(s || '').trim();
    if (s.length <= max) return s;
    return s.slice(0, max - 1) + '\u2026';
  }

  function addProfileChip(kind, rawText) {
    const host = document.getElementById('ws-profile-slots');
    if (!host) return;
    const span = document.createElement('span');
    span.className = 'ws-profile-chip';
    span.setAttribute('data-profile', kind);
    const full = String(rawText || '').trim();
    span.setAttribute('data-value', full);
    const labelKey = kind === 'email' ? 'accessGame.profileEmailSlot' : 'accessGame.profileNameSlot';
    span.setAttribute('aria-label', Tkey(labelKey) + ': ' + full);
    span.textContent = truncateProfileDisplay(rawText, kind === 'email' ? 34 : 22);
    host.appendChild(span);
  }

  function pulseLand() {
    if (dropTarget) {
      dropTarget.classList.add('ws-drop-target--land');
      window.setTimeout(function () {
        if (dropTarget) dropTarget.classList.remove('ws-drop-target--land');
      }, 500);
    }
    if (cartBtn) {
      cartBtn.classList.add('ws-cart-btn--pop');
      window.setTimeout(function () {
        if (cartBtn) cartBtn.classList.remove('ws-cart-btn--pop');
      }, 400);
    }
  }

  function endDragRestoreSource() {
    const tagEl = dragState.source;
    const clone = dragState.clone;
    if (clone && clone.parentNode) clone.remove();
    if (tagEl && tagEl.parentNode) {
      tagEl.classList.remove('ws-tag--ghost');
      tagEl.removeAttribute('aria-hidden');
      tagEl.removeAttribute('inert');
    }
    dragState.active = false;
    dragState.source = null;
    dragState.clone = null;
    dragState.moved = false;
    setDropTargetActive(false);
  }

  function wireInterestPointer(el, value) {
    el.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || currentStep !== 3) return;
      dragState.active = true;
      dragState.value = value;
      dragState.source = el;
      dragState.moved = false;
      dragState.sx = e.clientX;
      dragState.sy = e.clientY;
      dragState.pid = e.pointerId;
      const rect = el.getBoundingClientRect();
      dragState.ox = e.clientX - rect.left;
      dragState.oy = e.clientY - rect.top;
      const clone = el.cloneNode(true);
      clone.classList.remove('ws-tag--ghost');
      clone.classList.add('ws-tag--clone');
      clone.style.left = rect.left + 'px';
      clone.style.top = rect.top + 'px';
      clone.style.width = rect.width + 'px';
      clone.style.height = rect.height + 'px';
      clone.style.margin = '0';
      document.body.appendChild(clone);
      dragState.clone = clone;
      el.classList.add('ws-tag--ghost');
      el.setAttribute('aria-hidden', 'true');
      el.setAttribute('inert', '');
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      e.preventDefault();
    });

    el.addEventListener('pointermove', function (e) {
      if (!dragState.active || dragState.source !== el) return;
      if (Math.abs(e.clientX - dragState.sx) + Math.abs(e.clientY - dragState.sy) > 4) dragState.moved = true;
      if (dragState.clone) {
        dragState.clone.style.left = e.clientX - dragState.ox + 'px';
        dragState.clone.style.top = e.clientY - dragState.oy + 'px';
      }
      if (dropTarget && dragState.moved) {
        const r = dropTarget.getBoundingClientRect();
        setDropTargetActive(pointInRect(e.clientX, e.clientY, r));
      }
    });

    el.addEventListener('pointerup', function (e) {
      if (!dragState.active || dragState.source !== el) return;
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      const dest = dropTarget || cartBtn;
      const inCart = dest && pointInRect(e.clientX, e.clientY, dest.getBoundingClientRect());
      const clone = dragState.clone;
      const val = dragState.value;

      if (!dragState.moved) {
        setDropTargetActive(false);
        endDragRestoreSource();
        toggleCart(val);
        return;
      }

      if (inCart && !cartSet.has(val)) {
        if (clone && clone.parentNode) clone.remove();
        el.remove();
        dragState.active = false;
        dragState.source = null;
        dragState.clone = null;
        dragState.moved = false;
        cartSet.add(val);
        setDropTargetActive(false);
        updateCartUi();
        return;
      }

      setDropTargetActive(false);
      endDragRestoreSource();
    });

    el.addEventListener('pointercancel', function () {
      if (dragState.source === el) {
        setDropTargetActive(false);
        endDragRestoreSource();
      }
    });
  }

  function buildShelf() {
    if (!shelf) return;
    shelf.textContent = '';
    INTERESTS.forEach(function (item) {
      if (cartSet.has(item.value)) return;
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'ws-tag';
      el.setAttribute('data-interest', item.value);
      el.setAttribute('aria-pressed', 'false');
      el.textContent = Tkey(item.labelKey);
      el.setAttribute('title', Tkey('accessGame.tagDragTitle'));
      shelf.appendChild(el);
      wireInterestPointer(el, item.value);
    });
  }

  function updateStepUi() {
    if (stepHint) {
      stepHint.textContent = Tkey('accessGame.formHint');
    }
    if (wrapName) wrapName.hidden = currentStep !== 1;
    if (wrapEmail) wrapEmail.hidden = currentStep !== 2;
    if (wrapInterests) wrapInterests.hidden = currentStep !== 3;
    if (currentStep !== 3) closeInterestsHelpPopover();
    if (consentBlock) consentBlock.hidden = currentStep !== 3;
    if (cartZoneCaption) {
      const ckey =
        currentStep === 1
          ? 'accessGame.cartZoneStep1'
          : currentStep === 2
            ? 'accessGame.cartZoneStep2'
            : 'accessGame.cartZoneStep3';
      cartZoneCaption.textContent = Tkey(ckey);
    }
    const consentInput = document.getElementById('access-consent');
    if (consentInput) {
      if (currentStep === 3) consentInput.setAttribute('required', '');
      else consentInput.removeAttribute('required');
    }
    updateCartUi();
  }

  function flyGhostText(fromEl, text, done) {
    const targetEl = dropTarget || cartBtn;
    if (!targetEl) {
      done();
      return;
    }
    if (prefersReducedMotion()) {
      done();
      return;
    }
    const ghost = document.createElement('div');
    ghost.className = 'ws-fly-ghost';
    ghost.textContent = truncateProfileDisplay(text, 40);
    const fr = fromEl.getBoundingClientRect();
    const tr = targetEl.getBoundingClientRect();
    ghost.style.left = fr.left + 'px';
    ghost.style.top = fr.top + 'px';
    ghost.style.transform = 'translate(0,0) scale(0.92)';
    ghost.style.opacity = '1';
    ghost.style.transition = 'none';
    document.body.appendChild(ghost);
    void ghost.offsetWidth;
    ghost.style.transition =
      'transform 0.48s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.48s ease';
    const tx = tr.left + tr.width / 2 - fr.left - fr.width / 2;
    const ty = tr.top + tr.height / 2 - fr.top - fr.height / 2;
    var finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      ghost.removeEventListener('transitionend', onEnd);
      if (ghost.parentNode) ghost.remove();
      pulseLand();
      window.setTimeout(done, 100);
    }
    function onEnd() {
      finish();
    }
    ghost.addEventListener('transitionend', onEnd, { once: true });
    requestAnimationFrame(function () {
      ghost.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(1)';
      ghost.style.opacity = '0.98';
    });
    window.setTimeout(function () {
      if (!finished) finish();
    }, 800);
  }

  function validateName() {
    const name = document.getElementById('f-name');
    if (!name || !name.value.trim()) {
      alert(Tkey('accessGame.validationName'));
      name && name.focus();
      return false;
    }
    return true;
  }

  function validateEmailField() {
    const email = document.getElementById('f-email');
    if (!email || !email.value.trim()) {
      alert(Tkey('accessGame.validationEmail'));
      email && email.focus();
      return false;
    }
    if (typeof email.checkValidity === 'function' && !email.checkValidity()) {
      alert(Tkey('accessGame.validationEmail'));
      email.focus();
      return false;
    }
    return true;
  }

  function goStep2() {
    if (!validateName()) return;
    const name = document.getElementById('f-name');
    function advance() {
      addProfileChip('name', name.value);
      currentStep = 2;
      updateStepUi();
      const email = document.getElementById('f-email');
      email && email.focus();
    }
    if (prefersReducedMotion()) {
      pulseLand();
      advance();
      return;
    }
    flyGhostText(name, name.value, advance);
  }

  function goStep3() {
    if (!validateEmailField()) return;
    const email = document.getElementById('f-email');
    function advance() {
      addProfileChip('email', email.value);
      currentStep = 3;
      buildShelf();
      updateStepUi();
      const c = document.getElementById('access-consent');
      c && c.focus();
    }
    if (prefersReducedMotion()) {
      pulseLand();
      advance();
      return;
    }
    flyGhostText(email, email.value, advance);
  }

  if (btnNameNext) btnNameNext.addEventListener('click', goStep2);
  if (btnEmailNext) btnEmailNext.addEventListener('click', goStep3);

  const nameInput = document.getElementById('f-name');
  const emailInput = document.getElementById('f-email');
  if (nameInput) {
    nameInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && currentStep === 1) {
        e.preventDefault();
        goStep2();
      }
    });
  }
  if (emailInput) {
    emailInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && currentStep === 2) {
        e.preventDefault();
        goStep3();
      }
    });
  }

  function validateBeforeSubmit() {
    if (currentStep < 3) {
      alert(Tkey('accessGame.completeSteps'));
      return false;
    }
    const name = document.getElementById('f-name');
    const email = document.getElementById('f-email');
    const consent = document.getElementById('access-consent');
    if (!name || !name.value.trim()) {
      alert(Tkey('accessGame.validationName'));
      name && name.focus();
      return false;
    }
    if (!email || !email.value.trim()) {
      alert(Tkey('accessGame.validationEmail'));
      email && email.focus();
      return false;
    }
    if (cartSet.size < 1) {
      alert(Tkey('accessGame.validationInterest'));
      return false;
    }
    if (!consent || !consent.checked) {
      consent && consent.focus();
      try {
        consent && consent.reportValidity();
      } catch {
        /* ignore */
      }
      return false;
    }
    return true;
  }

  function setCartBusy(busy) {
    if (!cartBtn) return;
    if (cartBusyDelayTimer) {
      window.clearTimeout(cartBusyDelayTimer);
      cartBusyDelayTimer = null;
    }
    if (busy) {
      cartBtn.classList.add('ws-cart-btn--lock', 'ws-cart-btn--sending');
      cartBtn.setAttribute('aria-busy', 'true');
      cartBusyDelayTimer = window.setTimeout(function () {
        cartBusyDelayTimer = null;
        cartBtn.classList.add('ws-cart-btn--busy');
      }, 640);
    } else {
      cartBtn.classList.remove('ws-cart-btn--lock', 'ws-cart-btn--busy', 'ws-cart-btn--sending');
      cartBtn.setAttribute('aria-busy', 'false');
    }
  }

  function showCartMessage(key) {
    if (cartStatus) cartStatus.textContent = Tkey(key);
  }

  function resetCartAfterSubmitSuccess() {
    cartSet.clear();
    if (cartCount) cartCount.textContent = '0';
    if (cartBtn) cartBtn.classList.remove('ws-cart-btn--ready');
    syncInterestCheckboxes();
    syncInterestGate();
    renderMiniChips();
  }

  function resetStepFlow() {
    clearProfileSlots();
    currentStep = 1;
    buildShelf();
    updateStepUi();
    const name = document.getElementById('f-name');
    name && name.focus();
  }

  function resetCartVisual() {
    resetCartAfterSubmitSuccess();
    resetStepFlow();
    updateCartUi();
  }

  async function submitCart() {
    if (!form) return;
    if (dragState.active) return;
    syncLocaleField();
    syncInterestCheckboxes();

    if (!validateBeforeSubmit()) return;

    if (!IS_PLAYGROUND) {
      syncInterestGate();
      if (!form.checkValidity()) {
        try {
          form.reportValidity();
        } catch {
          /* ignore */
        }
        return;
      }
      const submitBtn = document.getElementById('access-hidden-submit');
      if (submitBtn && typeof form.requestSubmit === 'function') {
        form.requestSubmit(submitBtn);
      } else {
        try {
          form.submit();
        } catch {
          /* ignore */
        }
      }
      return;
    }

    const mock = !liveToggle || !liveToggle.checked;
    if (mock) {
      showCartMessage('accessGame.mockSuccess');
      return;
    }

    setCartBusy(true);
    showCartMessage('accessGame.loading');

    const action = await loadBrevoActionUrl();
    if (!isValidBrevoAction(action)) {
      showCartMessage('accessGame.error');
      setCartBusy(false);
      return;
    }
    form.setAttribute('action', action);

    const ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = ac ? window.setTimeout(function () { ac.abort(); }, BREVO_FETCH_TIMEOUT_MS) : null;

    try {
      const res = await fetch(action, {
        method: 'POST',
        body: new FormData(form),
        mode: 'cors',
        credentials: 'omit',
        signal: ac ? ac.signal : undefined,
      });
      if (timeoutId) window.clearTimeout(timeoutId);
      var bodyText = '';
      try {
        bodyText = await res.text();
      } catch (e2) {
        bodyText = '';
      }
      if (res.ok) {
        if (!bodyText || bodyText.trim().length < 64) {
          showCartMessage('accessGame.success');
          try {
            form.reset();
          } catch {
            /* ignore */
          }
          resetCartVisual();
          setCartBusy(false);
          return;
        }
        var okPhrase =
          /subscription has been successful|your subscription has been successful|suscripci[oó]n ha sido correcta|te has suscrito/i.test(
            bodyText
          );
        var errPhrase = /could not be saved|subscription could not|no se pudo guardar/i.test(bodyText);
        if (errPhrase && !okPhrase) {
          showCartMessage('accessGame.error');
          setCartBusy(false);
          return;
        }
        if (okPhrase && !errPhrase) {
          showCartMessage('accessGame.success');
          try {
            form.reset();
          } catch {
            /* ignore */
          }
          resetCartVisual();
          setCartBusy(false);
          return;
        }
        showCartMessage('accessGame.sibformsUncertain');
        setCartBusy(false);
        return;
      }
      try {
        form.submit();
      } catch {
        /* ignore */
      }
      showCartMessage('accessGame.success');
    } catch (err) {
      if (timeoutId) window.clearTimeout(timeoutId);
      console.warn('[waenn-subscribe]', err);
      try {
        form.submit();
      } catch {
        /* ignore */
      }
      showCartMessage('accessGame.success');
    } finally {
      setCartBusy(false);
    }
  }

  if (cartBtn) {
    cartBtn.addEventListener('click', function () {
      submitCart();
    });
    cartBtn.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        submitCart();
      }
    });
  }

  document.addEventListener('visibilitychange', function () {
    document.documentElement.classList.toggle('ac-paused', document.hidden);
  });

  function showSubscribeSuccessPersist() {
    const root = document.getElementById('access-experience');
    const done = document.getElementById('access-subscribe-done');
    if (!root || !done) return;
    done.removeAttribute('hidden');
    root.classList.add('access-experience--submitted');
    try {
      const t = done.querySelector('.access-subscribe-done__title');
      t && t.focus && t.setAttribute('tabindex', '-1');
      t && t.focus();
    } catch {
      /* ignore */
    }
  }

  function refreshSubscribeDoneI18n() {
    const done = document.getElementById('access-subscribe-done');
    if (!done || typeof window.i18nT !== 'function') return;
    done.querySelectorAll('[data-i18n]').forEach(function (el) {
      const k = el.getAttribute('data-i18n');
      if (!k) return;
      const v = window.i18nT(k);
      if (v && v !== k) el.textContent = v;
    });
  }

  if (!IS_PLAYGROUND) {
    window.addEventListener('waenn:formFeedback', function (ev) {
      const d = (ev && ev.detail) || {};
      if (d.key === 'accessGame.loading') setCartBusy(true);
      if (
        d.kind === 'success' &&
        (d.key === 'accessGame.success' || d.key === 'accessGame.successPending')
      ) {
        showSubscribeSuccessPersist();
        resetCartAfterSubmitSuccess();
        resetStepFlow();
      }
      if (d.kind === 'success' || d.kind === 'error') setCartBusy(false);
    });
  }

  function bootEmbedded() {
    currentStep = 1;
    clearProfileSlots();
    buildShelf();
    updateStepUi();
    syncLocaleField();
  }

  function playgroundResolveLang() {
    try {
      var q = new URLSearchParams(location.search).get('lang');
      if (q) {
        q = String(q).toLowerCase().split('-')[0];
        if (q === 'en' || q === 'es') return q;
      }
    } catch (e2) {
      /* ignore */
    }
    var h = document.documentElement.lang || 'es';
    h = String(h).toLowerCase().split('-')[0];
    return h === 'en' ? 'en' : 'es';
  }

  if (IS_PLAYGROUND) {
    loadI18n(playgroundResolveLang())
      .then(function () {
        bootEmbedded();
      })
      .catch(function () {
        i18nDict = {
          form: {
            optIdentidad: 'Identity and character',
            optPermanencia: 'Longevity and quality',
            optFit: 'A fit that truly works',
            namePlaceholder: 'Nombre',
            emailPlaceholder: 'Email',
          },
          accessGame: {
            title: 'Tu lista',
            formHint: 'Nombre, email y tu interés. Te avisaremos pronto.',
            cartZoneTitle: 'Tu carrito',
            cartZoneStep1: 'Aquí irá tu nombre y email.',
            cartZoneStep2: 'Luego añadirás intereses en esta zona.',
            cartZoneStep3: 'Suelta las fichas dentro del recuadro.',
            interestsQuestion:
              '¿Qué te importa en una prenda? Identidad, que dure o un buen encaje — elige una o varias.',
            interestsHelpToggle: 'Instrucciones: cómo añadir al carrito',
            interestsHelpPanelAria: 'Instrucciones para usar el carrito de intereses',
            dragIntro:
              'Arrastra cada opción hasta el recuadro punteado de la derecha, o toca la ficha para añadirla al carrito.',
            dropTargetAria: 'Zona del carrito',
            tagDragTitle: 'Arrastra al recuadro o toca',
            profileNameSlot: 'Nombre en tu carrito',
            profileEmailSlot: 'Email en tu carrito',
            continue: 'Continuar',
            completeSteps: 'Completa los pasos.',
            cartEmpty: 'Vacío',
            cartReady: 'Todo listo — pulsa el carrito',
            cartNeedInterest: 'Añade un interés; luego pulsa el carrito.',
            cartSubmitCta: 'Enviar — pulsa el carrito',
            cartAria: 'Carrito',
            loading: 'Enviando…',
            success: 'Revisa tu correo',
            successPending: 'Enviado; revisa correo/spam en unos minutos.',
            error: 'Error',
            mockSuccess: 'Modo prueba: no se envió',
            mockToggle: 'Envío real',
            consentBefore: 'Acepto comunicaciones y la ',
            consentPrivacyLink: 'política de privacidad',
            consentPrivacyAria: 'Política de privacidad',
            consentAfter: '.',
            validationName: 'Nombre',
            validationEmail: 'Email',
            validationInterest: 'Elige interés',
          },
        };
        applyI18nToDom();
        bootEmbedded();
      });
  } else if (window.i18nReady) {
    bootEmbedded();
  } else {
    window.addEventListener('i18n:ready', bootEmbedded, { once: true });
  }

  function refreshProfileChipI18n() {
    const host = document.getElementById('ws-profile-slots');
    if (!host) return;
    host.querySelectorAll('.ws-profile-chip').forEach(function (span) {
      const k = span.getAttribute('data-profile');
      const v = span.getAttribute('data-value') || span.textContent || '';
      const labelKey = k === 'email' ? 'accessGame.profileEmailSlot' : 'accessGame.profileNameSlot';
      span.setAttribute('aria-label', Tkey(labelKey) + ': ' + v);
    });
  }

  if (!IS_PLAYGROUND) {
    window.addEventListener('waenn:accessCartSync', function () {
      updateCartUi();
    });

    window.addEventListener('i18n:updated', function () {
      buildShelf();
      updateStepUi();
      syncLocaleField();
      refreshProfileChipI18n();
      refreshSubscribeDoneI18n();
    });
  }
})();
