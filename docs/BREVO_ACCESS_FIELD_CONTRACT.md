# Brevo — contrato de campos (acceso anticipado / cesta)

## Modo `waenn-proxy` (recomendado)

El navegador envía **JSON** a `POST /api/subscribe` (función serverless en [`api/subscribe.js`](../api/subscribe.js)). El servidor valida el cuerpo y llama a Brevo con la **API Double Opt-In**:

`POST https://api.brevo.com/v3/contacts/doubleOptinConfirmation`

con `email`, `includeListIds`, `templateId`, `redirectionUrl` y `attributes`. No usa `POST /v3/contacts` (crear contacto directo), para alinearse con el flujo de confirmación por email del formulario.

Variables de entorno en Vercel: **`BREVO_API_KEY`**, **`BREVO_LIST_ID`**, **`BREVO_DOUBLE_OPTIN_TEMPLATE_ID`**, **`BREVO_REDIRECTION_URL`**. Opcional: **`BREVO_LOCALE_ATTRIBUTE`** (solo si el atributo existe en Brevo). La API key no se expone en el cliente.

### Éxito en el cliente

[`main.js`](../main.js) considera el envío correcto solo si la respuesta HTTP es **2xx** y el JSON parseado incluye **`{ "ok": true }`**. Cualquier otro caso muestra error; **no** se hace fallback automático a Sibforms en modo `waenn-proxy`.

Campos del JSON (mismos nombres semánticos que el formulario):

| Campo | Tipo | Notas |
|--------|------|--------|
| `NOMBRE` | string | Igual que tabla siguiente. |
| `EMAIL` | string | Email normalizado (minúsculas recomendado). |
| `PRENDA_INTERES` | string[] | Mismo allowlist que `PRENDA_INTERES[]`; al menos un elemento. En Brevo el proxy envía **`PRENDA_INTERES` como array** en `attributes`. |
| `ACEPTA_MARKETING` | string | Debe ser `"1"` si el usuario aceptó. El servidor valida y envía a Brevo **`ACEPTA_MARKETING: true`** en `attributes` (atributo booleano en el panel). |
| `locale` | string | `es` o `en`. Solo se envía a Brevo si existe la variable **`BREVO_LOCALE_ATTRIBUTE`** y el atributo en el panel. |
| `email_address_check` | string | Honeypot; debe ir vacío. Si no está vacío, el servidor responde `200` `{ ok: true }` sin llamar a Brevo (respuesta silenciosa anti-bot). |

## Modo `waenn-sibforms` o iframe visible

La URL del `POST` se obtiene solo desde [`iframe.html`](../iframe.html) (dominio `*.sibforms.com`, ruta `/serve/…`), validada en [`main.js`](../main.js) y en [`assets/waenn-subscribe.js`](../assets/waenn-subscribe.js).

## Campos enviados a Brevo

| Campo | Tipo | Notas |
|--------|------|--------|
| `NOMBRE` | text | Máx. 200 caracteres; mismo `name` que en [`brevo.html`](../brevo.html). |
| `EMAIL` | email | Se normaliza a minúsculas en `main.js` antes del envío. |
| `PRENDA_INTERES[]` | checkbox (múltiple) | Valores **exactos** (strings, como en el formulario publicado / [`brevo.html`](../brevo.html)): `Identity and character`, `Longevity and quality`, `A fit that truly works`. Cualquier cambio en Brevo exige actualizar allowlist en [`api/subscribe.js`](../api/subscribe.js) y el widget. |
| `ACEPTA_MARKETING` | checkbox | Valor `1` cuando marcado. |
| `email_address_check` | text | Honeypot; debe ir vacío. |
| `locale` | hidden | `es` o `en` según idioma resuelto (`resolveLocale` en `main.js`). |

## UI (`assets/waenn-subscribe.js`)

- El estado visual del carrito sincroniza los checkboxes `PRENDA_INTERES[]`.
- `#access-interest-gate` es un campo auxiliar **sin** `name`: solo fuerza `setCustomValidity` para exigir ≥1 interés antes de `requestSubmit` (HTML5 no valida “al menos uno” en un grupo de checkboxes por defecto).

## Si cambias el formulario en Brevo

1. Exporta de nuevo el HTML del formulario y actualiza [`brevo.html`](../brevo.html) como referencia.
2. Ajusta valores de `PRENDA_INTERES[]`, nombres de campo o inputs ocultos en `index.html` y, si aplica, en [`waenn-subscribe/playground.html`](../waenn-subscribe/playground.html).
3. Actualiza este documento y las claves `accessGame.*` / `form.*` en `locales/es` y `locales/en` si cambia el copy.
4. Con `waenn-proxy`, mantén alineados **lista**, **plantilla DOI** y **atributos** con lo que envía [`api/subscribe.js`](../api/subscribe.js).

## reCAPTCHA v3 (Sibforms)

Si el formulario Brevo usa **reCAPTCHA v3** (como en [`brevo.html`](../brevo.html)), la **site key** pública va en **`#access-experience`** como `data-brevo-recaptcha-sitekey` (mismo valor que `data-sitekey` del bloque Brevo). El párrafo legal lo crea el módulo [`assets/waenn-subscribe.js`](../assets/waenn-subscribe.js); [`main.js`](../main.js) carga `api.js?render=…`, ejecuta `grecaptcha.execute(siteKey, { action: 'submit' })` y envía el token en **`g-recaptcha-response`**. Para desactivar, quita el atributo del widget. La CSP en [`vercel.json`](../vercel.json) incluye `www.google.com` y `www.gstatic.com`.

## Demo del widget

Abre [`waenn-subscribe/playground.html`](../waenn-subscribe/playground.html) sirviendo la **raíz** del repo (`npx serve .`) y visita `/waenn-subscribe/playground.html`. Por defecto el envío está en **modo prueba** hasta marcar el toggle de envío real (solo playground).

## Prueba manual end-to-end (Vercel + Brevo)

1. `vercel dev` en la raíz del repo con las env vars configuradas (o proyecto enlazado con `vercel env pull`).
2. Enviar con un email nuevo: en DevTools, `POST /api/subscribe` → **200** y cuerpo **`{ "ok": true }`**.
3. Logs de la función: Brevo **201** o **204** en la llamada DOI.
4. Bandeja (o spam): email de confirmación; tras el clic, contacto en la lista configurada.
5. Errores esperados: email inválido / sin interés → **400** `{ ok: false }`; honeypot → **200** `{ ok: true }` sin envío real; env mal configurada → **503** `{ ok: false }`; Brevo rechaza → **502** `{ ok: false }` y traza en logs del servidor.
