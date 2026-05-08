# WAENN — Official Landing Page

Landing page estática lista para desplegar en Vercel.

## Deploy en Vercel (recomendado)
- Importa el repo en Vercel.
- Framework preset: **Other** (sitio estático).
- Build command: **none**
- Output: **root** (Vercel detecta `index.html`).

## Assets
Todo lo que se sirva en producción está en `assets/`:
- `assets/waenn_logo.jpeg`
- `assets/image.png`
- `assets/magnific_starting-from-start-image_2895295034.mp4`

## Intro cinematográfica (máscara por scroll)
La intro usa `assets/waenn_logo.jpeg` como máscara (se invierte en runtime con canvas para que **solo se vea el interior de las letras**). Si el navegador no soporta `mask-image`, cae a un fallback.

## Acceso anticipado (Brevo)
### Opción A — Sin backend (la más segura)
Usa el **formulario embebido de Brevo** (double opt-in si queréis) y reemplaza el placeholder en `index.html` por el embed oficial.

Ventajas:
- No expones API keys
- Gestión completa desde Brevo (listas, segmentación, double opt-in)

### Opción B — Con endpoint serverless (recomendado si queréis UX 100% custom)
Si queréis mantener **vuestro formulario HTML** y enviar los datos a Brevo con su API **sin exponer la API key**, necesitáis un endpoint (serverless) en Vercel:
- `/api/subscribe` recibe `name`, `email`, `prenda`
- desde ahí llama a Brevo API para crear/actualizar el contacto y añadirlo a una lista

Esto **sí es backend**, pero “sin servidor”: se ejecuta como Function en Vercel y escala bien.

### Estado actual en este repo
Ahora mismo el formulario es un **placeholder**: muestra feedback de “recibido” si no está conectado a Brevo.

## Desarrollo local
Puedes abrir `index.html` directamente, pero para que el video/caché se comporte igual que en Vercel es mejor servirlo:

```bash
npx serve .
```

