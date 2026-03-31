import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useGetGame } from "@workspace/api-client-react";
import { useGameWebSocket } from "@/hooks/use-websocket";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, SkipForward, Trophy, Home,
  Copy, Check, Clock
} from "lucide-react";
import { CountdownBar, LoadingSpinner, AnswerGrid } from "@/components/game-ui";
import confetti from "canvas-confetti";
import { QRCodeSVG } from "qrcode.react";

type GameState = "lobby" | "question" | "leaderboard" | "podium";

interface LeaderboardEntry {
  nickname: string;
  score: number;
  rank: number;
}

type HostQA = {
  id: string;
  text: string;
  answer: string | null;
  answeredBy: string | null;
  isPublic: boolean;
  askedAt: number;
};

const HOST_ACCESS_STORAGE_KEY = "quizblast_host_access_code";
const HOST_DISPLAY_NAME_STORAGE_KEY = "quizblast_host_display_name";

export default function HostGame() {
  const [, params] = useRoute("/host/:gameCode");
  const [, setLocation] = useLocation();
  const gameCode = params?.gameCode || "";

  const { connected, lastMessage, emit } = useGameWebSocket();
  const { data: gameInfo, isLoading, error } = useGetGame(gameCode);

  const [gameState, setGameState] = useState<GameState>("lobby");
  const [players, setPlayers] = useState<Array<{ nickname: string; playerId: number }>>([]);
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [answersCount, setAnswersCount] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [correctOption, setCorrectOption] = useState<number | null>(null);
  const [timer, setTimer] = useState(0);

  // FIXED: Missing Q&A state
  const [qaItems, setQaItems] = useState<HostQA[]>([]);
  const [showQaPanel] = useState(false);
  const [unreadQa, setUnreadQa] = useState(0);

  const hostDisplayName =
    typeof window === "undefined"
      ? "Host"
      : window.sessionStorage.getItem(HOST_DISPLAY_NAME_STORAGE_KEY)?.trim() || "Host";

  const [copied, setCopied] = useState(false);

  // FIXED: Safe window usage
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const quizJoinUrl = `${origin}${import.meta.env.BASE_URL}?code=${gameCode}`.replace(/([^:])\/\//g, "$1/");
  const homeUrl = `${origin}${import.meta.env.BASE_URL}`.replace(/([^:])\/\//g, "$1/");

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // JOIN SOCKET
  useEffect(() => {
    if (!connected || !gameCode) return;

    const accessKey =
      typeof window === "undefined"
        ? null
        : window.sessionStorage.getItem(HOST_ACCESS_STORAGE_KEY)?.trim() || null;

    emit("host_join", { gameCode, accessKey, hostName: hostDisplayName });
  }, [connected, gameCode, emit, hostDisplayName]);

  // SOCKET EVENTS
  useEffect(() => {
    if (!lastMessage) return;

    const { type, payload } = lastMessage;

    switch (type) {
      case "player_joined":
        setPlayers((prev) =>
          prev.find((p) => p.playerId === payload.playerId)
            ? prev
            : [...prev, { nickname: payload.nickname, playerId: payload.playerId }]
        );
        break;

      case "question_started":
        setCurrentQuestion(payload.question);
        setQuestionIndex(payload.questionIndex);
        setTotalQuestions(payload.totalQuestions);
        setAnswersCount(0);
        setCorrectOption(null);
        setTimer(payload.question.timeLimit);
        setGameState("question");
        break;

      case "answer_submitted":
        setAnswersCount(payload.answeredCount);
        break;

      case "question_ended":
        setCorrectOption(payload.correctOption);
        setLeaderboard(payload.leaderboard || []);
        setTimer(0);
        setTimeout(() => setGameState("leaderboard"), 2500);
        break;

      case "game_ended":
        setGameState("podium");
        if (!showQaPanel) setUnreadQa((n) => n + 1);
        break;
    }
  }, [lastMessage, showQaPanel]);

  // TIMER
  useEffect(() => {
    if (gameState !== "question" || timer <= 0) return;

    const id = setInterval(() => setTimer((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(id);
  }, [gameState, timer]);

  // CONFETTI
  useEffect(() => {
    if (gameState !== "podium") return;

    const end = Date.now() + 5000;

    const frame = () => {
      confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 } });
      confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 } });
      if (Date.now() < end) requestAnimationFrame(frame);
    };

    frame();
  }, [gameState]);

  // LOADING + ERRORS
  if (isLoading) return <LoadingSpinner message="Loading Game..." />;

  if ((error as any)?.status === 401) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <button onClick={() => setLocation("/dashboard")}>
          Go to dashboard
        </button>
      </div>
    );
  }

  if (!gameInfo) return <div>Game not found</div>;

  // ACTIONS
  const handleStart = () => emit("start_game", { gameCode });
  const handleSkip = () => emit("end_question", { gameCode });
  const handleNext = () => emit("next_question", { gameCode });

  // ---------------- UI ----------------
  return (
    <div className="min-h-screen flex flex-col">

      {/* LOBBY */}
      {gameState === "lobby" && (
        <div className="p-6">
          <h2>{players.length} Players</h2>

          <button onClick={handleStart} disabled={!players.length}>
            Start Game
          </button>

          {players.map((p) => (
            <div key={p.playerId}>{p.nickname}</div>
          ))}
        </div>
      )}

      {/* QUESTION */}
      {gameState === "question" && currentQuestion && (
        <div className="p-6">
          <h2>{currentQuestion.text}</h2>
          <p>{timer}s</p>

          <AnswerGrid
            options={currentQuestion.options}
            disabled
            correctOption={correctOption ?? undefined}
            showResults={correctOption !== null}
          />

          <button onClick={handleSkip}>Skip</button>
        </div>
      )}

      {/* LEADERBOARD */}
      {gameState === "leaderboard" && (
        <div className="p-6">
          <h2>Leaderboard</h2>

          {leaderboard.slice(0, 5).map((p, i) => (
            <div key={i}>
              {p.nickname} - {p.score}
            </div>
          ))}

          <button onClick={handleNext}>Next</button>
        </div>
      )}

      {/* PODIUM */}
      {gameState === "podium" && (
        <div className="p-6 text-center">
          <h1>Podium</h1>

          {leaderboard[0] && <h2>🏆 {leaderboard[0].nickname}</h2>}

          <button onClick={() => setLocation("/dashboard")}>
            Dashboard
          </button>
        </div>
      )}
    </div>
  );
}