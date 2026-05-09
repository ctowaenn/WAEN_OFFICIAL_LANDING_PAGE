# WAENN landing — guía para agentes

## Qué es este repo

Sitio de una sola página (`index.html`) para la marca WAENN: intro con máscara scroll, secciones de marca, app, diferenciación, **acceso anticipado** con formulario gamificado, visión, etc. Despliegue típico: **Vercel** (estático + función `api/subscribe.js`). Por defecto `#s-access` usa **`waenn-proxy`** (POST `/api/subscribe` con DOI en servidor). Opcional **`waenn-sibforms`**: POST a Sibforms; la URL sale solo de `iframe.html`.

## Estilo y tokens

- Tipografía principal del cuerpo: Helvetica / sistema; la sección de acceso usa **Barlow Condensed** (Google Fonts en `index.html`).
- Variables globales en `styles.css` bajo `:root`: `--black`, `--dark`, `--red`, `--white`, `--beige`, `--tan`, `--nav-h`, máscara intro `--waenn-mask-url`, etc.
- El módulo `waenn-subscribe` define tokens locales en `#access-experience.ws-root` (`--ws-red`, `--ws-bg`, …) alineados con `--red` y `--black` cuando existen.

## i18n

- Ficheros: `locales/es/translation.json`, `locales/en/translation.json`.
- La landing usa `data-i18n` y el bus inicializa i18next (`i18n-init.js`); eventos `i18n:ready` / `i18n:updated`.
- El **playground** (`waenn-subscribe/playground.html`) usa `data-i18n-key` y carga JSON con `fetch` desde el propio `waenn-subscribe.js`.

## Motion (GSAP)

- `main.js` anima intro, scroll reveals, etc. Si tocáis timings de intro, buscad `ScrollTrigger`, `easeInOutQuint`, variables `--intro-*`.

## Módulo `waenn-subscribe` (Brevo)

- **Solo tocar** `assets/waenn-subscribe.css`, `assets/waenn-subscribe.js`, el bloque `#s-access` / `#access-experience` en `index.html`, y traducciones relacionadas con `accessGame` / `form.opt*` de intereses.
- **No renombrar** sin actualizar `main.js`: IDs usados por el fallback Brevo / feedback — `access-form`, `f-name`, `f-email`, `f-locale`, `access-consent`, `access-interest-gate`, `access-hidden-submit`, `access-cart-status`, `access-cart-count`, `brevo-hidden-frame`.
- El botón del carrito es `#ws-cart-btn` (clases `ws-cart-btn--ready`, `ws-cart-btn--busy`). `main.js` despacha `waenn:formFeedback` con claves `accessGame.loading|success|error` para sincronizar estado.
- **Modos** (`data-access-provider` en `#s-access`): `waenn-proxy` (predeterminado: POST `/api/subscribe` → Brevo DOI en servidor; éxito solo con `{ ok: true }`; sin fallback Sibforms), `waenn-sibforms` (POST Sibforms; URL solo desde `iframe.html`), `brevo-iframe` (iframe visible; `waenn-subscribe.js` no arranca). Tras republicar el form en Brevo, sincronizar `iframe.html` + `brevo.html`. Detalle: [`waenn-subscribe/MODE.md`](waenn-subscribe/MODE.md).
- En `waenn-sibforms` / iframe, la URL `action` del POST sale solo de `iframe.html` (dominio `sibforms.com`), validada en `main.js`.

## Contrato Brevo

Resumen en `docs/BREVO_ACCESS_FIELD_CONTRACT.md`. Los valores de `PRENDA_INTERES[]` deben coincidir **exactamente** con el formulario publicado en Brevo.
