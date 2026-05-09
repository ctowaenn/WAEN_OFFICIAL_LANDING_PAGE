# WAENN — Official Landing Page

Landing estática lista para desplegar en Vercel: una sola `index.html`, `styles.css`, `main.js`, assets en `assets/`, textos en `locales/`.

## Mapa de secciones (`index.html`)

| Ancla | Contenido (resumen) |
|--------|----------------------|
| `#s-intro` | Máscara scroll-reveal sobre imagen / logo WAENN |
| `#s-hero` | Hero principal |
| `#s-app` | Bloque app / teléfonos |
| `#s-ticker` | Cinta / ticker |
| `#s-dif` | Diferenciación |
| `#s-access` | Acceso anticipado: `data-access-provider` (`waenn-proxy` \| `waenn-sibforms` \| `brevo-iframe`) y `data-access-layout` (`split` \| `stack`). Ver [`waenn-subscribe/MODE.md`](waenn-subscribe/MODE.md). |
| `#s-vision` | Visión con vídeo |
| `#s-marca` | Pilares de marca |
| … | Footer y demás bloques según el HTML |

## Stack

- HTML + CSS + JS vanilla (sin bundler).
- **i18n**: `i18n-init.js` + `locales/<lang>/translation.json`; atributo `data-i18n` en nodos traducibles.
- **Motion**: GSAP / ScrollTrigger donde aplica (intro y reveals en `main.js`).
- **Brevo**: por defecto en la landing **`waenn-sibforms`** — el widget envía `POST` a la URL Sibforms leída de [`iframe.html`](iframe.html) (debe coincidir con el `action` del export en [`brevo.html`](brevo.html)). Alternativa **`waenn-proxy`**: `POST /api/subscribe` en Vercel con Double Opt-In en servidor. **`brevo-iframe`**: formulario embebido visible.

## Deploy en Vercel

- Importar el repo.
- Framework preset: **Other** (sitio estático).
- Build command: **none**
- Output: **root** (`index.html` en la raíz).

## Módulo `waenn-subscribe`

- **CSS / JS**: `assets/waenn-subscribe.css`, `assets/waenn-subscribe.js`
- **Markup**: bloque `#access-experience` en `index.html` (clases prefijo `ws-`).
- **Flujo UX**: pasos nombre → email → tres intereses (arrastre al icono carrito SVG) → consentimiento → toque en carrito para `requestSubmit` al formulario Brevo.
- **Demo aislada** (solo widget): [`waenn-subscribe/playground.html`](waenn-subscribe/playground.html) — ver [`waenn-subscribe/README.md`](waenn-subscribe/README.md).
- **Contrato de campos y checklist Brevo**: [`docs/BREVO_ACCESS_FIELD_CONTRACT.md`](docs/BREVO_ACCESS_FIELD_CONTRACT.md).
- **Referencia HTML export de Brevo**: [`brevo.html`](brevo.html).

### Mantenimiento URL Sibforms

Tras **republicar** el formulario en Brevo, copia el nuevo `action` del `<form>` al atributo `src` del iframe en [`iframe.html`](iframe.html) y alinea [`brevo.html`](brevo.html). Si solo cambias `brevo.html`, la landing **no** lo usa: [`main.js`](main.js) solo hace `fetch('iframe.html')` para obtener la URL.

## Desarrollo local

```bash
npx serve .
```

Probar `/` (landing) y `/waenn-subscribe/playground.html`.

## Guía para agentes (Cursor)

Ver [`CLAUDE.md`](CLAUDE.md): tokens, i18n, límites del módulo subscribe e IDs que no conviene romper.

## API + serverless (`waenn-proxy`)

Implementado en [`api/subscribe.js`](api/subscribe.js). Pon `data-access-provider="waenn-proxy"` en `#s-access` cuando quieras este modo.

**Variables en Vercel:** `BREVO_API_KEY`, `BREVO_LIST_ID`, `BREVO_DOUBLE_OPTIN_TEMPLATE_ID`, `BREVO_REDIRECTION_URL` (opcional `BREVO_LOCALE_ATTRIBUTE`).

**Verificación antes de dar por bueno el proxy**

1. `vercel dev` (o preview con env) y envío con email nuevo.
2. Network: `POST /api/subscribe` → **200** y cuerpo **`{"ok":true}`**.
3. Logs de la función: respuesta Brevo **201** o **204**.
4. Email DOI en bandeja; contacto en lista tras confirmar.

El cliente solo muestra éxito si la respuesta es `{ "ok": true }`; no hay fallback automático a Sibforms. Detalle en [`waenn-subscribe/MODE.md`](waenn-subscribe/MODE.md) y [`docs/BREVO_ACCESS_FIELD_CONTRACT.md`](docs/BREVO_ACCESS_FIELD_CONTRACT.md).
