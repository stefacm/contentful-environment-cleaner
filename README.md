# Contentful Environment Cleaner

CLI para limpiar Entries, Assets y Content Types de un environment de Contentful.

## Ejecución

1. Instala las dependencias:

   ```bash
   yarn install
   ```

2. Copia `.env.example` a `.env` y completa las credenciales.
3. Ejecuta una simulación:

   ```bash
   yarn clean
   ```

4. Para borrar realmente, usa `DRY_RUN=false` y confirma el mismo environment:

   ```bash
   DRY_RUN=false CONFIRM_ENVIRONMENT_ID=mi-environment yarn clean
   ```

El script rechaza aliases de environments por seguridad.

## Estructura

- `src/application`: casos de uso y reglas del flujo.
- `src/config`: configuración desde variables de entorno.
- `src/infrastructure`: integración concreta con Contentful.
- `src/presentation`: entrada CLI y salida por consola.
- `src/main.cjs`: punto de entrada principal.
