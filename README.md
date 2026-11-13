# UCC Pasto 3D — Frontend

Mapa 3D interactivo del campus Pasto de la Universidad Cooperativa de Colombia, con buscador
y el asistente con IA **Coopi**. Construido con **Vite + Three.js** y desplegado en **Vercel**.

## Funciones

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

- **Pantalla de carga** con barra de progreso y aviso "espere un momento" mientras el servidor despierta.
- **Usuarios**: registro obligatorio con correo y contraseña (máx. 30 caracteres, oculta), ingreso y
  sección de **invitados**. La contraseña se cifra en el navegador con SHA-256 (`src/sesion.js`) y solo
  viaja esa huella; el backend la vuelve a cifrar con BCrypt. La contraseña nunca se guarda.
- **Escudo de la universidad** en la entrada (tótem en la plaza, aviso y fachada del Bloque A).
- **Todos los programas**: al tocar uno se abre su ficha y Coopi pregunta "¿En qué te puedo ayudar con…?";
  las siguientes preguntas se responden en el contexto de ese programa.
- **Lugares**: restaurante (Cafetería del Bloque A, con interior recorrible), biblioteca, auditorio,
  canchas, clínica, Admisiones, Tesorería y más.
- **Coopi conversacional**: saluda "¡Hola! ¿Cómo estás? ¿En qué te puedo ayudar hoy?" y ejecuta acciones
  ("llévame al programa de Ingeniería de Software", "quiero ver el restaurante").
- **Voz** (`src/voz.js`): micrófono, modo «Ey Coopi» que escucha de fondo y respuestas habladas
  (Chrome o Edge).

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


