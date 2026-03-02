# 🎯 Prime Events — AI Proposal Generator

Generate comprehensive, professional event proposals from voice or text input using OpenAI Whisper (speech-to-text) and Claude AI (proposal generation).

![Feature 1 of Prime Events Platform]

---

## Features

- **Voice Input** — Record your event idea by speaking. Whisper transcribes it automatically.
- **Text Input** — Type your event description directly.
- **AI Proposal Generation** — Claude generates a full proposal: title, objectives, agenda, budget, committees, timeline, risks, and more.
- **Event Types** — Tailored for church events, corporate events, or general.
- **Export** — Print or download as JSON.
- **Beautiful UI** — Polished, animated, production-ready frontend.

---

## Architecture

```
┌──────────────────────────────┐
│         Next.js Frontend     │
│   (Voice recorder, Text UI,  │
│    Proposal renderer)        │
└──────────┬───────────────────┘
           │  REST API
┌──────────▼───────────────────┐
│      Express.js Backend      │
│                              │
│  /transcribe → Whisper API   │
│  /generate   → Claude API    │
│  /voice-to-proposal → Both   │
└──────────────────────────────┘
```

---

## Quick Start

### Prerequisites

- **Node.js** v18+ installed
- **OpenAI API key** (for Whisper transcription)
- **Anthropic API key** (for Claude proposal generation)

### 1. Clone / download this project

```bash
cd prime-events-proposal-generator
```

### 2. Set up the Backend

```bash
cd backend
npm install

# Create your .env file
cp .env.example .env
```

Edit `.env` and add your API keys:

```env
PORT=4000
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
FRONTEND_URL=http://localhost:3000
```

Start the backend:

```bash
npm run dev
```

The API will be running at `http://localhost:4000`

### 3. Set up the Frontend

Open a new terminal:

```bash
cd frontend
npm install

# Create your .env file
cp .env.example .env.local
```

The default `NEXT_PUBLIC_API_URL=http://localhost:4000/api` should work for local dev.

Start the frontend:

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## API Endpoints

### `POST /api/proposal/transcribe`
Upload audio file → returns transcribed text.

**Body:** `multipart/form-data` with `audio` file field.

**Response:**
```json
{ "transcript": "I want to organize a youth conference..." }
```

### `POST /api/proposal/generate`
Text description → returns structured proposal.

**Body:**
```json
{
  "description": "A 3-day youth conference with worship and workshops",
  "eventType": "church"
}
```

**Response:**
```json
{
  "proposal": {
    "title": "...",
    "objectives": ["..."],
    "budget": { ... },
    ...
  }
}
```

### `POST /api/proposal/voice-to-proposal`
Audio file → transcription + proposal in one call.

**Body:** `multipart/form-data` with `audio` file + optional `eventType` field.

**Response:**
```json
{
  "transcript": "...",
  "proposal": { ... }
}
```

---

## Project Structure

```
prime-events-proposal-generator/
├── backend/
│   ├── server.js              # Express server
│   ├── routes/proposal.js     # API endpoints
│   ├── services/whisper.js    # OpenAI Whisper integration
│   ├── services/claude.js     # Anthropic Claude integration
│   ├── prompts/proposalPrompt.js  # AI prompt engineering
│   └── .env.example
├── frontend/
│   ├── app/
│   │   ├── layout.js          # Root layout
│   │   ├── page.js            # Main page
│   │   └── globals.css        # Global styles
│   ├── components/
│   │   ├── Header.js          # Page header
│   │   ├── InputSection.js    # Text/Voice input tabs
│   │   ├── VoiceRecorder.js   # Microphone recording
│   │   ├── LoadingState.js    # AI generation loading
│   │   └── ProposalOutput.js  # Full proposal renderer
│   └── .env.example
└── README.md
```

---

## Deployment

### Backend (e.g., Railway, Render, Fly.io)

1. Deploy the `backend/` folder
2. Set environment variables (API keys, `FRONTEND_URL`)
3. The start command is `npm start`

### Frontend (e.g., Vercel)

1. Deploy the `frontend/` folder
2. Set `NEXT_PUBLIC_API_URL` to your deployed backend URL
3. Vercel auto-detects Next.js

---

## Next Features (Prime Events Roadmap)

- [ ] **Proposal Editing** — Edit sections inline after generation
- [ ] **PDF Export** — Download proposals as formatted PDFs
- [ ] **Database Storage** — Save and retrieve past proposals
- [ ] **User Authentication** — Login system with roles
- [ ] **Committee Management** — Assign members to committees
- [ ] **Approval Workflow** — Submit → Review → Approve flow
- [ ] **KingsChat Integration** — Notifications and sharing

---

## License

Proprietary — Prime Events. All rights reserved.
