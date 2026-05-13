import { WebSocket } from "ws";
import { logger } from "./logger";

interface Player {
  playerId: number;
  nickname: string;
  score: number;
  ws: WebSocket;
  answeredCurrentQuestion: boolean;
}

export interface LiveQuestion {
  id: string;
  playerId: number;
  text: string;
  answer: string | null;
  answeredBy: string | null;
  answeredAt: number | null;
  askedAt: number;
  isPublic: boolean;
}

export interface GlobalLiveQuestion {
  id: string;
  clientId: string;
  text: string;
  answer: string | null;
  answeredBy: string | null;
  answeredAt: number | null;
  askedAt: number;
  isPublic: boolean;
}

interface GameSession {
  gameCode: string;
  quizId: number;
  gameId: number; // DB primary key — cached to avoid per-submit SELECT
  status: "waiting" | "active" | "finished";
  currentQuestionIndex: number;
  questions: Array<{
    id: number;
    text: string;
    options: string[];
    correctOption: number;
    timeLimit: number;
    points: number;
  }>;
  players: Map<number, Player>;
  hostWss: Set<WebSocket>;
  questionTimer: ReturnType<typeof setTimeout> | null;
  questionStartTime: number;
  liveQuestions: LiveQuestion[];
  questionEnding: boolean; // guard against double endQuestion calls
}

const gameSessions = new Map<string, GameSession>();

// Throttle map for answer_submitted broadcasts: fire at most once per 150 ms per game.
const answerBroadcastTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function scheduleAnswerCountBroadcast(gameCode: string): void {
  if (answerBroadcastTimers.has(gameCode)) return;
  answerBroadcastTimers.set(gameCode, setTimeout(() => {
    answerBroadcastTimers.delete(gameCode);
    const session = gameSessions.get(gameCode);
    if (!session) return;
    let answeredCount = 0;
    for (const p of session.players.values()) {
      if (p.answeredCurrentQuestion) answeredCount++;
    }
    broadcast(gameCode, {
      type: "answer_submitted",
      payload: { answeredCount, totalPlayers: session.players.size },
    });
  }, 150));
}

// Q&A that is not tied to a game PIN.
// Hosts (with valid host access) receive these questions in real-time.
const globalLiveQuestions: GlobalLiveQuestion[] = [];
const MAX_GLOBAL_QA = 500;

// Periodically remove global Q&A entries older than 24 hours to prevent unbounded growth.
setInterval(() => {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  let i = globalLiveQuestions.length;
  while (i--) {
    if (globalLiveQuestions[i].askedAt < cutoff) globalLiveQuestions.splice(i, 1);
  }
}, 60 * 60 * 1000);

// Evict game sessions that have been idle (no host, no active players) for over 2 hours.
// This covers abandoned games where endGame() was never called.
const SESSION_IDLE_EVICT_MS = 2 * 60 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [gameCode, session] of gameSessions) {
    if (session.status === "finished") continue;
    const hasOpenHost = Array.from(session.hostWss).some(ws => ws.readyState === 1 /* OPEN */);
    const hasOpenPlayer = Array.from(session.players.values()).some(p => p.ws.readyState === 1);
    if (!hasOpenHost && !hasOpenPlayer && now - session.questionStartTime > SESSION_IDLE_EVICT_MS) {
      if (session.questionTimer) clearTimeout(session.questionTimer);
      gameSessions.delete(gameCode);
      logger.info({ gameCode }, "Evicted idle game session");
    }
  }
}, 30 * 60 * 1000);

export function addGlobalLiveQuestion(clientId: string, text: string): GlobalLiveQuestion | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const q: GlobalLiveQuestion = {
    id: `global-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    clientId,
    text: trimmed.slice(0, 300),
    answer: null,
    answeredBy: null,
    answeredAt: null,
    askedAt: Date.now(),
    isPublic: false,
  };

  const MAX_PER_CLIENT_GLOBAL_QA = 5;
  const clientCount = globalLiveQuestions.filter(q => q.clientId === clientId && !q.answer).length;
  if (clientCount >= MAX_PER_CLIENT_GLOBAL_QA) return null;

  // If at capacity, evict already-answered entries first.
  if (globalLiveQuestions.length >= MAX_GLOBAL_QA) {
    let i = globalLiveQuestions.length;
    while (i--) {
      if (globalLiveQuestions[i].answer !== null) globalLiveQuestions.splice(i, 1);
    }
  }
  // Still at capacity after eviction — reject the new question.
  if (globalLiveQuestions.length >= MAX_GLOBAL_QA) return null;

  globalLiveQuestions.push(q);
  return q;
}

export function answerGlobalLiveQuestion(questionId: string, answer: string, answeredBy: string): GlobalLiveQuestion | null {
  const q = globalLiveQuestions.find((x) => x.id === questionId);
  if (!q) return null;

  const trimmed = answer.trim();
  if (!trimmed) return null;

  q.answer = trimmed.slice(0, 500);
  q.answeredBy = answeredBy.trim().slice(0, 40) || "Host";
  q.answeredAt = Date.now();
  q.isPublic = false;
  return q;
}

export function publishGlobalLiveQuestion(questionId: string): GlobalLiveQuestion | null {
  const q = globalLiveQuestions.find((x) => x.id === questionId);
  if (!q) return null;

  q.isPublic = true;
  if (!q.answeredAt) q.answeredAt = Date.now();
  return q;
}

export function getGlobalLiveQuestions(): GlobalLiveQuestion[] {
  return globalLiveQuestions;
}

export function getGameSession(gameCode: string): GameSession | undefined {
  return gameSessions.get(gameCode);
}

export function createGameSession(gameCode: string, quizId: number, gameId = 0): GameSession {
  const session: GameSession = {
    gameCode,
    quizId,
    gameId,
    status: "waiting",
    currentQuestionIndex: -1,
    questions: [],
    players: new Map(),
    hostWss: new Set(),
    questionTimer: null,
    questionStartTime: 0,
    liveQuestions: [],
    questionEnding: false,
  };
  gameSessions.set(gameCode, session);
  return session;
}

const MAX_QA_PER_PLAYER = 5;

export function addLiveQuestion(gameCode: string, playerId: number, text: string): LiveQuestion | null {
  const session = gameSessions.get(gameCode);
  if (!session) return null;

  // Limit unanswered questions per player to prevent Q&A spam.
  const pending = session.liveQuestions.filter(q => q.playerId === playerId && !q.answer).length;
  if (pending >= MAX_QA_PER_PLAYER) return null;

  const q: LiveQuestion = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    playerId,
    text: text.slice(0, 300),
    answer: null,
    answeredBy: null,
    answeredAt: null,
    askedAt: Date.now(),
    isPublic: false,
  };
  session.liveQuestions.push(q);
  return q;
}

export function answerLiveQuestion(gameCode: string, questionId: string, answer: string, answeredBy: string): LiveQuestion | null {
  const session = gameSessions.get(gameCode);
  if (!session) return null;

  const q = session.liveQuestions.find(q => q.id === questionId);
  if (!q) return null;

  q.answer = answer.slice(0, 500);
  q.answeredBy = answeredBy.trim().slice(0, 40) || "Host";
  q.answeredAt = Date.now();
  return q;
}

export function publishLiveQuestion(gameCode: string, questionId: string): LiveQuestion | null {
  const session = gameSessions.get(gameCode);
  if (!session) return null;

  const q = session.liveQuestions.find(q => q.id === questionId);
  if (!q) return null;

  q.isPublic = true;
  if (!q.answeredAt) q.answeredAt = Date.now();
  return q;
}

export function getLiveQuestions(gameCode: string): LiveQuestion[] {
  return gameSessions.get(gameCode)?.liveQuestions ?? [];
}

export function setGameQuestions(gameCode: string, questions: GameSession["questions"]): void {
  const session = gameSessions.get(gameCode);
  if (session) {
    session.questions = questions;
  }
}

export function addPlayerToSession(gameCode: string, playerId: number, nickname: string, ws: WebSocket): boolean {
  const session = gameSessions.get(gameCode);
  if (!session || session.status === "finished") return false;

  session.players.set(playerId, {
    playerId,
    nickname,
    score: 0,
    ws,
    answeredCurrentQuestion: false,
  });
  return true;
}

export function setHostWs(gameCode: string, ws: WebSocket): void {
  const session = gameSessions.get(gameCode);
  if (session) {
    session.hostWss.add(ws);
  }
}

export function removeHostWs(gameCode: string, ws: WebSocket): void {
  const session = gameSessions.get(gameCode);
  if (session) {
    session.hostWss.delete(ws);
  }
}

export function broadcast(gameCode: string, message: object, excludeWs?: WebSocket): void {
  const session = gameSessions.get(gameCode);
  if (!session) return;

  const data = JSON.stringify(message);

  for (const hostWs of session.hostWss.values()) {
    if (hostWs.readyState !== WebSocket.OPEN) {
      session.hostWss.delete(hostWs);
      continue;
    }

    if (hostWs !== excludeWs) {
      hostWs.send(data);
    }
  }

  for (const player of session.players.values()) {
    if (player.ws !== excludeWs && player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(data);
    }
  }
}

export function broadcastToPlayers(gameCode: string, message: object): void {
  const session = gameSessions.get(gameCode);
  if (!session) return;

  const data = JSON.stringify(message);
  for (const player of session.players.values()) {
    if (player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(data);
    }
  }
}

export function sendToHost(gameCode: string, message: object): void {
  const session = gameSessions.get(gameCode);
  if (!session) return;

  const data = JSON.stringify(message);
  for (const hostWs of session.hostWss.values()) {
    if (hostWs.readyState !== WebSocket.OPEN) {
      session.hostWss.delete(hostWs);
      continue;
    }

    hostWs.send(data);
  }
}

export function sendToPlayer(gameCode: string, playerId: number, message: object): void {
  const session = gameSessions.get(gameCode);
  if (!session) return;
  const player = session.players.get(playerId);
  if (player && player.ws.readyState === WebSocket.OPEN) {
    player.ws.send(JSON.stringify(message));
  }
}

export function getLeaderboard(gameCode: string): Array<{ nickname: string; score: number; rank: number }> {
  const session = gameSessions.get(gameCode);
  if (!session) return [];

  const sorted = Array.from(session.players.values())
    .sort((a, b) => b.score - a.score)
    .map((p, i) => ({ nickname: p.nickname, score: p.score, rank: i + 1 }));

  return sorted;
}

export function startQuestion(gameCode: string, onTimeout: (gameCode: string) => void): boolean {
  const session = gameSessions.get(gameCode);
  if (!session || session.currentQuestionIndex >= session.questions.length - 1) return false;

  session.currentQuestionIndex += 1;
  session.questionStartTime = Date.now();
  session.questionEnding = false;

  for (const player of session.players.values()) {
    player.answeredCurrentQuestion = false;
  }

  const question = session.questions[session.currentQuestionIndex];

  if (session.questionTimer) {
    clearTimeout(session.questionTimer);
  }

  const capturedIndex = session.currentQuestionIndex;
  session.questionTimer = setTimeout(() => {
    // Guard against the timer firing after the question was already ended or the game finished.
    const s = gameSessions.get(gameCode);
    if (!s || s.status !== "active" || s.currentQuestionIndex !== capturedIndex) return;
    onTimeout(gameCode);
  }, question.timeLimit * 1000 + 1000);

  broadcast(gameCode, {
    type: "question_started",
    payload: {
      questionIndex: session.currentQuestionIndex,
      question: {
        text: question.text,
        options: question.options,
        timeLimit: question.timeLimit,
        points: question.points,
      },
      totalQuestions: session.questions.length,
    },
  });

  return true;
}

export function submitAnswer(
  gameCode: string,
  playerId: number,
  questionIndex: number,
  selectedOption: number,
  timeToAnswer: number
): { isCorrect: boolean; pointsEarned: number } | null {
  const session = gameSessions.get(gameCode);
  if (!session || session.status !== "active") return null;

  const player = session.players.get(playerId);
  if (!player || player.answeredCurrentQuestion) return null;

  if (questionIndex !== session.currentQuestionIndex) return null;

  const question = session.questions[questionIndex];
  const isCorrect = selectedOption === question.correctOption;

  let pointsEarned = 0;
  if (isCorrect) {
    const clampedTime = Math.max(0, Math.min(timeToAnswer, question.timeLimit * 1000));
    const timeRatio = 1 - clampedTime / (question.timeLimit * 1000);
    pointsEarned = Math.round(question.points * (0.5 + 0.5 * timeRatio));
  }

  player.answeredCurrentQuestion = true;
  player.score += pointsEarned;

  return { isCorrect, pointsEarned };
}

export function getAnsweredCount(gameCode: string): { answeredCount: number; totalPlayers: number } {
  const session = gameSessions.get(gameCode);
  if (!session) return { answeredCount: 0, totalPlayers: 0 };

  let answeredCount = 0;
  for (const player of session.players.values()) {
    if (player.answeredCurrentQuestion) answeredCount++;
  }

  return { answeredCount, totalPlayers: session.players.size };
}

export function endQuestion(gameCode: string): void {
  const session = gameSessions.get(gameCode);
  if (!session || session.status !== "active") return;
  // Guard: timer callback and isAllAnswered() can both fire in the same event-loop
  // pass when the last answer arrives just as the timeout fires.
  if (session.questionEnding) return;
  session.questionEnding = true;

  if (session.questionTimer) {
    clearTimeout(session.questionTimer);
    session.questionTimer = null;
  }

  // Cancel any pending throttled answer_submitted broadcast for this question.
  const pendingTimer = answerBroadcastTimers.get(gameCode);
  if (pendingTimer) {
    clearTimeout(pendingTimer);
    answerBroadcastTimers.delete(gameCode);
  }

  const question = session.questions[session.currentQuestionIndex];
  const leaderboard = getLeaderboard(gameCode);

  broadcast(gameCode, {
    type: "question_ended",
    payload: {
      correctOption: question.correctOption,
      leaderboard: leaderboard.slice(0, 10),
    },
  });
}

export function endGame(gameCode: string): void {
  const session = gameSessions.get(gameCode);
  if (!session) return;

  session.status = "finished";

  if (session.questionTimer) {
    clearTimeout(session.questionTimer);
    session.questionTimer = null;
  }

  broadcast(gameCode, {
    type: "game_ended",
    payload: { gameCode },
  });

  setTimeout(() => {
    gameSessions.delete(gameCode);
    logger.info({ gameCode }, "Game session cleaned up");
  }, 30 * 60 * 1000);
}

export function removePlayer(gameCode: string, playerId: number): void {
  const session = gameSessions.get(gameCode);
  if (!session) return;
  session.players.delete(playerId);
}

export function isAllAnswered(gameCode: string): boolean {
  const session = gameSessions.get(gameCode);
  if (!session) return false;

  for (const player of session.players.values()) {
    if (player.ws.readyState === WebSocket.OPEN && !player.answeredCurrentQuestion) return false;
  }
  return session.players.size > 0;
}

export function isLastQuestion(gameCode: string): boolean {
  const session = gameSessions.get(gameCode);
  if (!session) return true;
  return session.currentQuestionIndex >= session.questions.length - 1;
}

export function startGameSession(gameCode: string): boolean {
  const session = gameSessions.get(gameCode);
  if (!session || session.status !== "waiting" || session.players.size === 0) return false;
  session.status = "active";
  return true;
}

export function getSessionPlayerCount(gameCode: string): number {
  const session = gameSessions.get(gameCode);
  return session?.players.size ?? 0;
}
