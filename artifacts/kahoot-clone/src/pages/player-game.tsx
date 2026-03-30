import { useEffect, useState, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { useGameWebSocket } from "@/hooks/use-websocket";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, Home, Loader2 } from "lucide-react";
import { AnswerGrid } from "@/components/game-ui";
import confetti from "canvas-confetti";

type PlayerState = "lobby" | "answering" | "waiting" | "result" | "podium";

export default function PlayerGame() {
  const [, params] = useRoute("/play/:gameCode");
  const [, setLocation] = useLocation();
  const gameCode = params?.gameCode || "";
  
  const nickname = sessionStorage.getItem("quizblast_nickname");
  const [playerId, setPlayerId] = useState<number | null>(null);
  
  const { connected, lastMessage, emit } = useGameWebSocket();
  const [gameState, setGameState] = useState<PlayerState>("lobby");
  
  const [currentOptions, setCurrentOptions] = useState<string[]>([]);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [questionIndex, setQuestionIndex] = useState<number>(0);
  const [questionStartTime, setQuestionStartTime] = useState<number>(0);
  const [lastResult, setLastResult] = useState<{isCorrect: boolean, points: number, score: number, rank: number} | null>(null);
  const hasJoined = useRef(false);

  // Redirect if no nickname
  useEffect(() => {
    if (!nickname) {
      setLocation("/");
    }
  }, [nickname, setLocation]);

  // Join game - only once when first connected
  useEffect(() => {
    if (connected && gameCode && nickname && !hasJoined.current) {
      hasJoined.current = true;
      emit("player_join", { gameCode, nickname });
    }
  }, [connected, gameCode, nickname, emit]);

  // Handle WS Messages
  useEffect(() => {
    if (!lastMessage) return;
    const { type, payload } = lastMessage;

    switch (type) {
      case "joined":
        setPlayerId(payload.playerId);
        break;

      case "question_started":
        setCurrentOptions(payload.question.options);
        setQuestionIndex(payload.questionIndex);
        setQuestionStartTime(Date.now());
        setSelectedOption(null);
        setLastResult(null);
        setGameState("answering");
        break;

      case "score_update":
        setLastResult({ isCorrect: payload.isCorrect, points: payload.pointsEarned, score: payload.score, rank: payload.rank });
        setGameState("result");
        break;

      case "question_ended":
        if (gameState === "answering") {
          setGameState("result");
          setLastResult(prev => prev ?? { isCorrect: false, points: 0, score: 0, rank: 0 });
        }
        break;

      case "game_ended":
        setGameState("podium");
        break;
    }
  }, [lastMessage]);

  const handleSelectOption = (index: number) => {
    if (selectedOption !== null || !playerId) return;
    setSelectedOption(index);
    setGameState("waiting");
    const timeToAnswer = Date.now() - questionStartTime;
    emit("submit_answer", { 
      gameCode, 
      playerId, 
      questionIndex,
      selectedOption: index, 
      timeToAnswer,
    });
  };

  useEffect(() => {
    if (gameState === "result" && lastResult?.isCorrect) {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }
  }, [gameState, lastResult]);

  if (!nickname) return null;

  return (
    <div className="fixed inset-0 bg-background flex flex-col font-sans overflow-hidden">
      
      {/* Header */}
      <header className="h-16 bg-white/90 backdrop-blur border-b border-border flex items-center justify-between px-4 z-20 shrink-0">
        <div className="font-display font-bold text-muted-foreground tracking-widest uppercase">PIN: {gameCode}</div>
        <div className="font-bold text-foreground bg-muted px-4 py-1 rounded-full">{nickname}</div>
      </header>

      {/* LOBBY STATE */}
      {gameState === "lobby" && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-primary text-white">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center"
          >
            <h1 className="text-4xl md:text-5xl font-display font-black mb-4 text-stroke">You're in!</h1>
            <p className="text-2xl font-bold opacity-90">See your nickname on screen</p>
            
            <div className="mt-16 flex justify-center">
              <Loader2 className="animate-spin" size={48} />
            </div>
          </motion.div>
        </div>
      )}

      {/* ANSWERING STATE */}
      {gameState === "answering" && (
        <div className="flex-1 p-2 pb-6">
          <AnswerGrid options={currentOptions} onSelect={handleSelectOption} />
        </div>
      )}

      {/* WAITING STATE */}
      {gameState === "waiting" && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-muted">
          <Loader2 className="animate-spin text-muted-foreground mb-6" size={64} />
          <h2 className="text-3xl font-display font-bold text-foreground text-center">Waiting for others...</h2>
        </div>
      )}

      {/* RESULT STATE */}
      {gameState === "result" && lastResult && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`flex-1 flex flex-col items-center justify-center p-6 text-white ${lastResult.isCorrect ? 'bg-quiz-green' : 'bg-quiz-red'}`}
        >
          {lastResult.isCorrect ? (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex flex-col items-center">
              <CheckCircle2 size={100} className="mb-6 drop-shadow-md" />
              <h1 className="text-5xl font-display font-black mb-2 text-stroke">Correct!</h1>
              <div className="text-3xl font-bold bg-black/20 px-6 py-2 rounded-full mt-4">+{lastResult.points}</div>
            </motion.div>
          ) : (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex flex-col items-center">
              <XCircle size={100} className="mb-6 drop-shadow-md" />
              <h1 className="text-5xl font-display font-black mb-2 text-stroke">Incorrect</h1>
              <p className="text-xl font-bold mt-4 opacity-90">Better luck next time!</p>
            </motion.div>
          )}

          <div className="absolute bottom-10 left-0 right-0 px-8 flex justify-between items-center bg-black/20 py-4 font-bold text-xl backdrop-blur-sm">
            <div>Score: {lastResult.score}</div>
            <div>Rank: {lastResult.rank}</div>
          </div>
        </motion.div>
      )}

      {/* PODIUM STATE */}
      {gameState === "podium" && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-primary text-white">
          <Trophy size={80} className="text-quiz-yellow mb-8 drop-shadow-xl" />
          <h1 className="text-5xl font-display font-black mb-4 text-stroke">Game Over</h1>
          <p className="text-2xl font-bold mb-12">Check the big screen for results!</p>
          <button 
            onClick={() => setLocation('/')}
            className="game-button bg-white text-primary px-8 py-4 rounded-2xl text-xl font-black shadow-[0_6px_0_0_rgba(0,0,0,0.2)] flex items-center gap-2"
          >
            <Home /> Home
          </button>
        </div>
      )}

    </div>
  );
}
