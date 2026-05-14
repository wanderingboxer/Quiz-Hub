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
  connectionTimeoutMillis: 5000,
});
export const db = drizzle(pool, { schema });

// Creates all tables and indexes that don't already exist.
// Safe to call on every startup — every statement is idempotent.
export async function ensureSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS quizzes (
      id          serial PRIMARY KEY,
      title       text        NOT NULL,
      description text,
      created_at  timestamptz NOT NULL DEFAULT now(),
      updated_at  timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS questions (
      id             serial PRIMARY KEY,
      quiz_id        integer     NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
      text           text        NOT NULL,
      options        jsonb       NOT NULL,
      correct_option integer     NOT NULL,
      time_limit     integer     NOT NULL DEFAULT 20,
      points         integer     NOT NULL DEFAULT 1000,
      order_index    integer     NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS questions_quiz_id_idx ON questions(quiz_id);

    CREATE TABLE IF NOT EXISTS games (
      id                     serial PRIMARY KEY,
      game_code              text        NOT NULL UNIQUE,
      quiz_id                integer     NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
      status                 text        NOT NULL DEFAULT 'waiting',
      current_question_index integer,
      created_at             timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS players (
      id           serial PRIMARY KEY,
      game_id      integer     NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      nickname     text        NOT NULL,
      score        integer     NOT NULL DEFAULT 0,
      is_connected integer     NOT NULL DEFAULT 1,
      joined_at    timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS players_game_id_idx ON players(game_id);

    CREATE TABLE IF NOT EXISTS answers (
      id              serial PRIMARY KEY,
      game_id         integer     NOT NULL REFERENCES games(id)    ON DELETE CASCADE,
      player_id       integer     NOT NULL REFERENCES players(id)  ON DELETE CASCADE,
      question_id     integer     NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      selected_option integer     NOT NULL,
      is_correct      integer     NOT NULL DEFAULT 0,
      points_earned   integer     NOT NULL DEFAULT 0,
      time_to_answer  integer,
      answered_at     timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS answers_game_id_idx   ON answers(game_id);
    CREATE INDEX IF NOT EXISTS answers_player_id_idx ON answers(player_id);
    CREATE INDEX IF NOT EXISTS answers_question_id_idx ON answers(question_id);
  `);
}

export * from "./schema";
