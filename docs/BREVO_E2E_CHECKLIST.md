# Checklist E2E — suscripción Brevo (`waenn-proxy`)

## Brevo: API key e IPs (causa típica de 502)

Si `POST /api/subscribe` devuelve **502** con `brevoStatus: 401` y un mensaje de **IP no reconocida**, en Brevo tienes activa la restricción **Security → Authorized IPs** para la API key.

Las funciones de Vercel salen por **IPs dinámicas**; no puedes listar una sola IP fija salvo planes/features específicos.

**Solución recomendada:** desactiva el bloqueo por IP para la API key que usa el servidor (o crea una key **sin** restricción IP solo para `api/subscribe`). No afecta al SMTP con IP distinta.

## Pre-requisitos (Vercel)

En el proyecto Vercel (Production y Preview si pruebas previews):

| Variable | Uso |
|----------|-----|
| `BREVO_API_KEY` | API key (servidor únicamente). |
| `BREVO_LIST_ID` | Lista numérica tras confirmar DOI. |
| `BREVO_DOUBLE_OPTIN_TEMPLATE_ID` | Plantilla DOI activa en Brevo. |
| `BREVO_REDIRECTION_URL` | Opcional: por defecto `https://{Host}/gracias` (Vercel reescribe a [`gracias.html`](../gracias.html)). También válido: `https://www.waenn.com/gracias.html`. |
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
