import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});
export const db = drizzle(pool, { schema });

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS quizzes (
    id          serial      PRIMARY KEY,
    title       text        NOT NULL,
    description text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS questions (
    id             serial  PRIMARY KEY,
    quiz_id        integer NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    text           text    NOT NULL,
    options        jsonb   NOT NULL,
    correct_option integer NOT NULL,
    time_limit     integer NOT NULL DEFAULT 20,
    points         integer NOT NULL DEFAULT 1000,
    order_index    integer NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS questions_quiz_id_idx ON questions(quiz_id);

  CREATE TABLE IF NOT EXISTS games (
    id                     serial      PRIMARY KEY,
    game_code              text        NOT NULL UNIQUE,
    quiz_id                integer     NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    status                 text        NOT NULL DEFAULT 'waiting',
    current_question_index integer,
    created_at             timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS players (
    id           serial      PRIMARY KEY,
    game_id      integer     NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    nickname     text        NOT NULL,
    score        integer     NOT NULL DEFAULT 0,
    is_connected integer     NOT NULL DEFAULT 1,
    joined_at    timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS players_game_id_idx ON players(game_id);

  CREATE TABLE IF NOT EXISTS answers (
    id              serial      PRIMARY KEY,
    game_id         integer     NOT NULL REFERENCES games(id)     ON DELETE CASCADE,
    player_id       integer     NOT NULL REFERENCES players(id)   ON DELETE CASCADE,
    question_id     integer     NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    selected_option integer     NOT NULL,
    is_correct      integer     NOT NULL DEFAULT 0,
    points_earned   integer     NOT NULL DEFAULT 0,
    time_to_answer  integer,
    answered_at     timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS answers_game_id_idx     ON answers(game_id);
  CREATE INDEX IF NOT EXISTS answers_player_id_idx   ON answers(player_id);
  CREATE INDEX IF NOT EXISTS answers_question_id_idx ON answers(question_id);
`;

// Creates all tables and indexes if they don't exist. Safe to run on every
// startup — all statements are idempotent. Retries with backoff to handle
// Neon/serverless DB cold-start ("endpoint disabled" transient errors).
export async function ensureSchema(): Promise<void> {
  const MAX_ATTEMPTS = 6;
  const BASE_DELAY_MS = 3000;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await pool.query(SCHEMA_SQL);
      return;
    } catch (err) {
      if (attempt === MAX_ATTEMPTS) throw err;
      const delay = BASE_DELAY_MS * attempt;
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[ensureSchema] attempt ${attempt}/${MAX_ATTEMPTS} failed (${message}) — retrying in ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export * from "./schema";
