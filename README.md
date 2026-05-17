# AI Study Arena

AI Study Arena is a real-time, competitive study platform that turns collaborative learning into an arena-style quiz battle. The app uses live chat and AI-powered scoring to create context-aware quizzes and a leaderboard-driven experience.

---

## Project Overview

This repo contains two main parts:

- `backend/` — Express server, AI integration, quiz and matchmaking logic, Supabase connectivity, and real-time socket communication.
- `frontend/` — React + Vite single-page app for the game UI, profile pages, matchmaking flow, study room, quiz battle, and leaderboard.

The system is designed for interactive learning sessions with AI-backed question generation and multiplayer/single-player scoring.

---

## Key Features

- Real-time chat-based study room
- AI-powered quiz generation from discussion context
- Matchmaking for AI or human opponents
- Persistent leaderboard and player profile support
- Responsive React UI with Vite
- Backend API server using Express and Socket.io

---

## Tech Stack

- Frontend: React 19, Vite, Tailwind CSS, React Router
- Backend: Node.js, Express, Socket.io
- AI & Integrations: OpenAI / OpenRouter, Supabase
- Utilities: dotenv, cors, nodemon

---

## Repository Structure

- `backend/`
  - `server.js` — main API and socket server
  - `routes/` — route definitions for quiz, profile, and leaderboard
  - `services/` — business logic for battles, matchmaking, AI, and ranking
  - `config/` — database and AI configuration
  - `middleware/` — validation helpers
  - `data/` — static constants and taxonomy content

- `frontend/`
  - `src/` — React app source code
  - `src/pages/` — app screens like Home, Matchmaking, QuizBattle, Profile, Leaderboard
  - `src/context/` — app state and auth context
  - `src/lib/api.js` — API client helpers
  - `public/` — static assets

---

## Prerequisites

- Node.js 18 or newer
- npm
- Optional: Git if cloning from a repository

---

## Setup

### Option 1: Automated setup

Use the provided automation scripts for the easiest experience:

- `SETUP_AND_RUN.bat` — installs dependencies and starts the app
- `start.bat` — launches the app after setup

### Option 2: Manual setup

Open two terminals and run:

```powershell
cd backend
npm install
cd ../frontend
npm install
```

---

## Running the App

### Backend

```powershell
cd backend
npm run dev
```

### Frontend

```powershell
cd frontend
npm run dev
```

The frontend will typically run on `http://localhost:5173` and the backend on `http://localhost:5000`.

---

## Environment Variables

Create a `.env` file in `backend/` with values for your API keys and database connection.

Example keys:

```env
OPENAI_API_KEY=your-openai-api-key
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
```

> Do not commit `.env` or any secret keys to source control.

---

## Scripts

### Backend scripts

- `npm start` — run the backend server
- `npm run dev` — run with nodemon
- `npm run fresh` — kill port 5000 and restart dev server

### Frontend scripts

- `npm run dev` — start Vite development server
- `npm run build` — build production assets
- `npm run preview` — preview production build
- `npm run lint` — lint frontend files

---

## Notes

- The backend uses Socket.io for real-time game events.
- The frontend uses Supabase for data persistence and authentication-related flows.
- The project is designed to be extended with additional subjects, AI personas, and scoring rules.

---

## Contributing

If you want to improve the project:

1. Fork the repo
2. Create a new branch
3. Add or fix a feature
4. Submit a pull request

---

## License

Check repository metadata for license details.
