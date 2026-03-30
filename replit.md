# Workspace

## Overview

pnpm workspace monorepo using TypeScript. QuizBlast - a full-featured Kahoot clone with unlimited quizzes, unlimited questions, 500+ player support, and real-time multiplayer gameplay.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (ESM bundle)
- **Frontend**: React + Vite (Tailwind, shadcn/ui, framer-motion, canvas-confetti)
- **Real-time**: WebSocket (ws) via `/api/ws`

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server + WebSocket
│   └── kahoot-clone/       # React + Vite frontend (QuizBlast)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Features

### QuizBlast (Kahoot Clone)
- **Home page**: Join a game with code + nickname, or host a game
- **Dashboard**: Create, edit, delete quizzes, launch game sessions
- **Quiz Editor**: Add/edit/delete questions with 4 answer options, configurable time limit and points
- **Host Lobby**: Share 6-character game code, see players join in real-time, start game
- **Host Game**: See current question, answer distribution, timer, skip question, view mini-leaderboard
- **Player Join**: Enter game code and nickname on any device
- **Player Lobby**: Wait for host to start, see nickname confirmed on host screen
- **Player Game**: Answer colored buttons (Red/Blue/Yellow/Green), see correct/incorrect feedback, score/rank
- **Results/Podium**: Animated 3-place podium with confetti, full leaderboard

### Real-time Communication
- WebSocket server at `/api/ws`
- Host messages: host_join, start_game, next_question, end_question
- Player messages: player_join, submit_answer
- Server broadcasts: player_joined, game_started, question_started, answer_submitted, question_ended, game_ended, score_update

## Database Schema

- `quizzes` - Quiz title, description
- `questions` - Question text, options (JSONB), correctOption, timeLimit, points, orderIndex
- `games` - Game sessions with 6-char game code, quiz reference, status
- `players` - Player nicknames, scores, connection state
- `answers` - Player answers with correctness and points earned

## Packages

### `artifacts/api-server`
Express 5 API server with WebSocket support.
- `pnpm --filter @workspace/api-server run dev` — dev server

### `artifacts/kahoot-clone`
React + Vite frontend (QuizBlast UI)
- `pnpm --filter @workspace/kahoot-clone run dev` — dev server

### `lib/db`
- `pnpm --filter @workspace/db run push` — push schema changes

### `lib/api-spec`
- `pnpm --filter @workspace/api-spec run codegen` — regenerate types/hooks
