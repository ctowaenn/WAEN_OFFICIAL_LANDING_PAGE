# WAENN Subscribe — modos de acceso y seguridad

## `data-access-provider` en `#s-access` ([`index.html`](../index.html))

| Valor | Descripción |
|--------|-------------|
| **`waenn-sibforms`** (predeterminado en [`index.html`](../index.html)) | Mismo módulo; el navegador envía al `action` HTTPS de `*.sibforms.com` obtenido solo desde [`iframe.html`](../iframe.html). Coincide con el flujo DOI / plantillas del formulario publicado en Brevo. Sin backend propio. Tras republicar el formulario en Brevo, actualiza `iframe.html` y el export en [`brevo.html`](../brevo.html). Si el formulario Brevo tiene **reCAPTCHA v3**, define `data-brevo-recaptcha-sitekey` en **`#access-experience`** (misma key que en Brevo); el aviso legal lo inserta [`assets/waenn-subscribe.js`](../assets/waenn-subscribe.js) y [`main.js`](../main.js) adjunta el token `g-recaptcha-response` al POST. |
| **`waenn-proxy`** | Módulo + `POST /api/subscribe` cuando la página se sirve por **http(s)**. El servidor llama a la API **Double Opt-In** de Brevo (`/v3/contacts/doubleOptinConfirmation`). **No hay fallback automático** a Sibforms si el proxy falla. Requiere env vars en Vercel (ver más abajo). Con **`file://`** no existe `/api/subscribe`; usa `vercel dev` o `waenn-sibforms`. La API key solo en el servidor. |
| **`brevo-iframe`** | Oculta el módulo; muestra el iframe visible de Brevo (`.access-brevo-host`). [`assets/waenn-subscribe.js`](../assets/waenn-subscribe.js) **no** se inicializa. |

## `data-access-layout` en `#s-access`

| Valor | Descripción |
|--------|-------------|
| **`split`** | Dos columnas en desktop: copy (`.access-left`) + módulo o iframe (`.access-right`). |
| **`stack`** | Una columna: copy arriba a ancho completo, bloque del formulario abajo. |

## Variables de entorno (solo modo `waenn-proxy`)

En el proyecto de Vercel:

- **`BREVO_API_KEY`** — API key de Brevo (Settings → SMTP & API → API keys).
- **`BREVO_LIST_ID`** — ID numérico de la lista a la que se añadirá el contacto **tras** confirmar el DOI.
- **`BREVO_DOUBLE_OPTIN_TEMPLATE_ID`** — ID numérico de la **plantilla de email** de double opt-in (debe estar activa y enlazada al flujo DOI).
- **`BREVO_REDIRECTION_URL`** — URL absoluta (`https://…`) a la que redirige Brevo tras confirmar (p. ej. tu `index.html` o una página de gracias). Debe ser una URL válida según la configuración de la plantilla (p. ej. `{{ params.DOIurl }}` si la plantilla lo usa).

Opcional:

- **`BREVO_LOCALE_ATTRIBUTE`** — Nombre exacto de un **atributo de contacto** que exista en Brevo. Si está definido, el servidor envía `es` o `en` en `attributes` bajo esa clave. Si no existe el atributo en el panel, **no** lo configures: la API puede responder *Attribute not found*.
- **`SUBSCRIBE_MAX_BODY_BYTES`** — Tamaño máximo del cuerpo JSON (por defecto `16384`).

El endpoint [`api/subscribe.js`](../api/subscribe.js) valida honeypot, intereses permitidos, consentimiento y hace rate limiting básico por IP. En respuestas Brevo no OK se registra en logs (status, código y mensaje) sin exponer la API key ni datos personales completos.

## Checklist Brevo (producción con `waenn-proxy`)

1. Lista con el ID configurado en `BREVO_LIST_ID`.
2. Plantilla DOI activa con el ID en `BREVO_DOUBLE_OPTIN_TEMPLATE_ID` (incluye enlace de confirmación según documentación Brevo).
3. Atributos de contacto existentes para lo que envía el proxy: **`NOMBRE`** (texto), **`PRENDA_INTERES`** (tipo compatible con **lista/array de valores** — el proxy envía **array de strings**).
4. Si necesitas idioma en Brevo: crea el atributo y define `BREVO_LOCALE_ATTRIBUTE` con su nombre exacto.
5. Prueba con `vercel dev`: envío → Network `200` y `{ "ok": true }` → email de confirmación → contacto en lista tras clic.

## Atributos de contacto en Brevo (proxy)

El proxy envía en `attributes` **`NOMBRE`**, **`PRENDA_INTERES`** (array de strings) y **`ACEPTA_MARKETING`** (`true` cuando el usuario aceptó en el formulario). El campo `locale` del JSON del cliente **no** se reenvía a Brevo salvo que exista `BREVO_LOCALE_ATTRIBUTE`.

## Referencias

- Contrato de campos: [`docs/BREVO_ACCESS_FIELD_CONTRACT.md`](../docs/BREVO_ACCESS_FIELD_CONTRACT.md)
- Integración cliente: [`main.js`](../main.js) (`getAccessProvider`, envío proxy vs Sibforms; éxito del proxy solo con `{ ok: true }`)
