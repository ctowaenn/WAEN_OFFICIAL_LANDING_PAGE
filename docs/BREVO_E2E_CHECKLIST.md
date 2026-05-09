# Checklist E2E — suscripción Brevo (`waenn-proxy`)

## Pre-requisitos (Vercel)

En el proyecto Vercel (Production y Preview si pruebas previews):

| Variable | Uso |
|----------|-----|
| `BREVO_API_KEY` | API key (servidor únicamente). |
| `BREVO_LIST_ID` | Lista numérica tras confirmar DOI. |
| `BREVO_DOUBLE_OPTIN_TEMPLATE_ID` | Plantilla DOI activa en Brevo. |
| `BREVO_REDIRECTION_URL` | Opcional: si falta, [`api/subscribe.js`](../api/subscribe.js) usa `https://{Host}/gracias.html` según la petición (o `https://{VERCEL_URL}/gracias.html`). Puedes fijarla igualmente, p. ej. `https://www.waenn.com/gracias.html`. |
| `BREVO_LOCALE_ATTRIBUTE` | Opcional: nombre exacto de atributo de contacto para `es`/`en`. |

Atributos de contacto usados por el proxy: **`NOMBRE`**, **`PRENDA_INTERES`** (array de strings), **`ACEPTA_MARKETING`** (boolean). Deben existir en Brevo y ser compatibles con el payload.

## Cliente (landing)

1. `#s-access` con `data-access-provider="waenn-proxy"` (predeterminado en `index.html`).
2. Enviar con un **email nuevo** (no reutilices uno ya confirmado si quieres ver el mail de DOI otra vez).
3. DevTools → Network → `POST /api/subscribe`:
   - **200** y cuerpo **`{"ok":true}`** → el widget mostrará éxito.
   - **503** → faltan env vars o `REDIRECTION_URL` inválida.
   - **400** → validación (interés, consentimiento, email…).
   - **502** → Brevo rechazó; revisar logs de función en Vercel.

## Servidor / Brevo

1. Logs de la función en Vercel: respuesta Brevo **201** o **204** en `doubleOptinConfirmation`.
2. Bandeja (y **spam**): email de confirmación DOI.
3. Tras clic en el enlace: contacto en la lista configurada.

## Smoke test local (sin desplegar)

Desde la raíz del repo:

```bash
node scripts/verify-subscribe-api.js
```

Sin env: debe imprimir **503** y `{"ok":false}`. Con env completa y cuenta Brevo válida puede imprimir **200** y `{"ok":true}`.
