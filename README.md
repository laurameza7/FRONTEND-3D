# UCC Pasto 3D — Frontend

Interactive 3D map of the Pasto campus of Universidad Cooperativa de Colombia, with search and
the AI assistant **Coopi**. Built with **Vite + Three.js** and deployed on **Vercel**.

The code (files, variables, functions, CSS classes, comments and tests) is written in English.
Everything the user sees on screen stays in Spanish, because the users are the students and
visitors of the Pasto campus.

## Features

- 3D campus: blocks, paths, green areas and trees; rotate, zoom and select.
- Panel with the information of each block: offices, laboratories, schedules, phones and programs.
- Search for blocks, offices and programs.
- Chat with the AI: it answers questions and highlights on the map the block it mentions.
- Responsive design for phones.
- **Loading screen** with a progress bar and a "please wait" notice while the server wakes up.
- **Users**: registration with email and password (max. 30 characters, hidden), login and a
  **guest** option. The password is hashed in the browser with SHA-256 (`src/session.js`) and only
  that fingerprint travels; the backend hashes it again with BCrypt. The password is never stored.
- **University shield** at the entrance (totem on the plaza, sign and facade of Block A).
- **All programs**: tapping one opens its card and Coopi asks "¿En qué te puedo ayudar con…?";
  the next questions are answered in the context of that program.
- **Places**: restaurant (Block A cafeteria, with a walkable interior), library, auditorium,
  courts, clinic, Admisiones, Tesorería and more.
- **Conversational Coopi**: greets "¡Hola! ¿Cómo estás? ¿En qué te puedo ayudar hoy?" and runs actions
  ("llévame al programa de Ingeniería de Software", "quiero ver el restaurante").
- **Voice** (`src/voice.js`): microphone, «Ey Coopi» mode that listens in the background and spoken
  answers (Chrome or Edge).
- **First-person walkthrough of the interiors, as in the campus videos** (`src/floors.js` generates each
  floor, `src/blocks.js` describes it, `src/floorPlans.js` has the hand-made plans and `src/walkthrough.js`
  is the engine):
  - Block B: floors 1 to 7 and basements — Faculties of Medicine, Engineering, Nursing and Law, classrooms,
    Industrial Engineering laboratories, Innovation Laboratory (605), Operations Laboratory, hearing rooms,
    Bienestar Universitario with the gym and the Urcunina Auditorium.
  - Block A: basement (auditorium and clinical simulation), cafeteria and Faculty of Dentistry, two-level
    library, computer rooms, Law program, Open Language Center and the rooftop courts.
  - You walk with W A S D / arrows or by clicking on the floor, go up and down the stairs, and cross from
    one block to the other through the passages of each floor. There is an "Ir a…" menu and a minimap.
  - Realistic materials: exposed brick with bump, polished reflective floors, wooden doors, the grid
    ceiling of Block A with yellow pipes, the wooden band on the walls and contact shadows.

All the data comes from the Java backend (`BACKEND-3D`), which reads it from the database (`BASE-DATOS-3D-`).

## Project structure

```
src/
  main.js          -> app start, panels, search, chat with Coopi and its actions (COMMAND pattern)
  api.js           -> client of the backend REST API
  session.js       -> register / login / guest, SHA-256 of the password
  voice.js         -> speech recognition and synthesis ("Ey Coopi")
  campus3d.js      -> outdoor 3D map of the campus
  walkthrough.js   -> first-person engine and construction Kit (walls, stairs, furniture, signs)
  floors.js        -> generator of typical floors from data
  blocks.js        -> floors of blocks A and B as seen in the videos
  floorPlans.js    -> hand-made plans (Block B floor 1, basements, cafeteria) and furniture
  styles.css
tests/             -> unit tests (Vitest)
e2e/               -> end-to-end tests (Playwright) with a simulated API (e2e/data)
```

## Running locally

```bash
npm install
cp .env.example .env      # and set the backend URL (or http://localhost:8080)
npm run dev
```

## Tests

```bash
npm test          # unit tests with Vitest (≈100 cases, seconds)
npm run e2e       # end-to-end tests with Playwright in Chromium (desktop and phone)
```

- **Unit** (`tests/`): the password becomes a 64-character SHA-256 fingerprint and never travels,
  the API client sends the token and shows the backend errors, the «Ey Coopi» wake word and its variants,
  and that **every place in the database** of blocks A and B has its destination on the right floor of the walkthrough.
- **End-to-end** (`e2e/`): the real application is opened with a simulated API (real campus data in
  `e2e/data`) and the tests check login, registering without sending the password, Coopi taking you to the
  library, the gym and a faculty, the list of programs, changing floors and the phone layout.
  Each of the 16 floors is also built to check that **every destination can be reached walking**.

GitHub Actions runs both on every push (**Actions** tab).

## Deploying on Vercel

1. Import this repository at https://vercel.com/new (framework: **Vite**).
2. In *Environment Variables* add `VITE_API_URL` = URL of the backend on Render.
3. Deploy. Every push to `main` is published automatically.
