# UCC Pasto 3D — Frontend

Mapa 3D interactivo del campus Pasto de la Universidad Cooperativa de Colombia, con buscador
y el asistente con IA **Coopi**. Construido con **Vite + Three.js** y desplegado en **Vercel**.

## Funciones (avance 70 %)

- Campus en 3D: bloques, senderos, zonas verdes y árboles; girar, acercar y seleccionar.
- Panel con la información de cada bloque: oficinas, laboratorios, horarios, teléfonos y programas.
- Buscador de bloques, oficinas y programas.
- Chat con la IA: responde preguntas y resalta en el mapa el bloque que menciona.
- Diseño adaptable a celular.
- **Recorrido por dentro (primera persona)** del Bloque B: Piso 1 (entrada, AMI, Tesorería, Admisiones,
  sala de espera), Piso 0 (lockers, Laboratorio de Morfología, casilleros) y Sótano 2 (Clínica
  Odontológica: sala de espera, Atención al Usuario, Archivo, Posgrado y pregrado). Se camina con
  W A S D / flechas o clic en el piso, se cambia de piso bajando o subiendo las escaleras, y hay
  menú "Ir a…" y minimapa. Los interiores están en `src/planos.js` y el motor en `src/recorrido.js`.

Todos los datos vienen del backend en Java (`ucc-pasto3d-backend`), que a su vez los lee de la
base de datos (`ucc-pasto3d-database`).

## Correr en el computador

```bash
npm install
cp .env.example .env      # y poner la URL del backend (o http://localhost:8080)
npm run dev
```

## Despliegue en Vercel

1. Importar este repositorio en https://vercel.com/new (framework: **Vite**).
2. En *Environment Variables* agregar `VITE_API_URL` = URL del backend en Render.
3. Deploy. Cada push a `main` se publica automáticamente.


