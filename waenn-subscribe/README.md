# waenn-subscribe (playground)

Demo mínima del módulo de suscripción Brevo embebido en `#access-experience` en la landing. Aquí solo aparece el widget (sin cabecera ni footer del sitio).

## Cómo abrirlo

Desde la **raíz del repositorio**:

```bash
npx serve .
```

Luego en el navegador: `http://localhost:3000/waenn-subscribe/playground.html` (el puerto puede variar según `serve`).

## Idioma (sin botones en el widget)

El playground **no** incluye selector ES/EN: el idioma sale de `<html lang="...">` o del query opcional **`?lang=es`** / **`?lang=en`**, que carga `locales/<lang>/translation.json`.

En la **landing**, el idioma lo controla el toggle del nav y `i18n-init.js`; el widget solo usa `window.i18nT` / eventos `i18n:ready` e `i18n:updated`.

## Comportamiento

- **Envío real**: el checkbox `#ws-playground-live` desactiva el modo prueba; si está marcado, el script intenta leer la acción Brevo desde `../iframe.html` y enviar por `fetch` (o iframe oculto como respaldo), igual que en producción.
- Estilos: `../styles.css` (tokens globales) + `../assets/waenn-subscribe.css`; lógica: `../assets/waenn-subscribe.js`.

Documentación del contrato de campos: [`docs/BREVO_ACCESS_FIELD_CONTRACT.md`](../docs/BREVO_ACCESS_FIELD_CONTRACT.md).

Modos de la landing (`waenn-proxy` / `waenn-sibforms` / `brevo-iframe`) y variables de entorno: [`MODE.md`](MODE.md).
