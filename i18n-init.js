/* global i18next, i18nextHttpBackend, i18nextBrowserLanguageDetector */
(function () {
  'use strict';

  function resolvedLang() {
    return (i18next.resolvedLanguage || i18next.language || 'es').split('-')[0];
  }

  function setDocumentMeta() {
    document.documentElement.lang = resolvedLang();
    var title = i18next.t('meta.title');
    if (title && title !== 'meta.title') document.title = title;
    var metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      var d = i18next.t('meta.description');
      if (d && d !== 'meta.description') metaDesc.setAttribute('content', d);
    }
  }

  function applyDataI18n(root) {
    var scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (!key) return;
      var val = i18next.t(key);
      if (!val || val === key) return;
      el.textContent = val;
    });

    scope.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-placeholder');
      if (!key) return;
      var val = i18next.t(key);
      if (val && val !== key) el.setAttribute('placeholder', val);
    });

    scope.querySelectorAll('[data-i18n-aria-label]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-aria-label');
      if (!key) return;
      var val = i18next.t(key);
      if (val && val !== key) el.setAttribute('aria-label', val);
    });

    scope.querySelectorAll('[data-i18n-alt]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-alt');
      if (!key) return;
      var val = i18next.t(key);
      if (val && val !== key) el.setAttribute('alt', val);
    });
  }

  function renderTicker() {
    var track = document.getElementById('ticker-track');
    if (!track) return;
    var items = i18next.t('ticker.items', { returnObjects: true });
    if (!Array.isArray(items) || !items.length) return;
    track.textContent = '';
    function appendCycle() {
      for (var i = 0; i < items.length; i++) {
        var span = document.createElement('span');
        span.className = 'ticker-item';
        span.textContent = items[i];
        track.appendChild(span);
        var dot = document.createElement('span');
        dot.className = 'ticker-dot';
        dot.textContent = '·';
        track.appendChild(dot);
      }
    }
    appendCycle();
    appendCycle();
  }

  function updateLangToggle() {
    var lang = resolvedLang();
    document.querySelectorAll('[data-lang]').forEach(function (btn) {
      var target = btn.getAttribute('data-lang');
      var on = target === lang;
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.classList.toggle('lang-toggle__btn--active', on);
    });
  }

  function applyTranslations() {
    setDocumentMeta();
    applyDataI18n();
    renderTicker();
    updateLangToggle();
  }

  function wireLangToggle() {
    document.querySelectorAll('[data-lang]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var lng = btn.getAttribute('data-lang');
        if (lng) i18next.changeLanguage(lng);
      });
    });
  }

  function finishInit() {
    window.i18nT = function (key, opts) {
      return i18next.t(key, opts);
    };
    window.i18nReady = true;
    applyTranslations();
    i18next.on('languageChanged', applyTranslations);
    wireLangToggle();
    window.dispatchEvent(new Event('i18n:ready'));
  }

  function failInit() {
    window.i18nT = function (key) {
      return key;
    };
    window.i18nReady = true;
    window.dispatchEvent(new Event('i18n:ready'));
  }

  if (typeof i18next === 'undefined') {
    failInit();
    return;
  }

  var useBackend = typeof i18nextHttpBackend !== 'undefined';
  var useDetector = typeof i18nextBrowserLanguageDetector !== 'undefined';

  if (useBackend) i18next.use(i18nextHttpBackend);
  if (useDetector) i18next.use(i18nextBrowserLanguageDetector);

  i18next
    .init({
      fallbackLng: 'es',
      supportedLngs: ['es', 'en'],
      nonExplicitSupportedLngs: true,
      load: 'languageOnly',
      interpolation: { escapeValue: false },
      backend: useBackend
        ? { loadPath: 'locales/{{lng}}/translation.json' }
        : undefined,
      detection: useDetector
        ? {
            order: ['querystring', 'localStorage', 'navigator'],
            lookupQuerystring: 'lng',
            caches: ['localStorage'],
          }
        : undefined,
    })
    .then(finishInit)
    .catch(failInit);
})();
