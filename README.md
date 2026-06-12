# Catalogo para GitHub Pages

Esta carpeta contiene una web estatica para una biblioteca popular. Puede publicarse gratis en GitHub Pages.

## Como usarla

1. Subir estos archivos a un repositorio de GitHub.
2. Activar GitHub Pages desde `Settings > Pages`.
3. Entrar a la web publicada.
4. Ir a `Administracion`.
5. Descargar la plantilla o importar un Excel existente.
6. Usar `Buscar tapas y sinopsis` para completar datos con Google Books.
7. Usar `Exportar catalogo.json`.
8. Reemplazar el archivo `data/catalogo.json` del repositorio por el archivo descargado.

## Columnas del Excel

Columnas aceptadas:

```text
titulo, autor, categoria, anio, isbn, estado, notas, estante, imagen, sinopsis, destacado, tematica
```

La columna `isbn` es la mas importante para buscar tapa y sinopsis en Google Books.

## Sobre la API de Google Books

La web funciona sin API key para usos moderados. Si se agrega una API key en `Configuracion`, se guarda solo en el navegador.

No conviene escribir una API key privada directamente en el codigo de una pagina publica.

## Limitaciones de GitHub Pages

GitHub Pages no tiene base de datos propia. Por eso:

- El catalogo publico sale del archivo `data/catalogo.json`.
- Los prestamos y sugerencias quedan guardados en el navegador donde se usan.
- Para reseñas, sugerencias online y aprobacion real conviene conectar Supabase, Firebase, Google Forms o Formspree.
