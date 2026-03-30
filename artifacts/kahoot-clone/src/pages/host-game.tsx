import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useGetGame, useGetGameResults } from "@workspace/api-client-react";
import { useGameWebSocket } from "@/hooks/use-websocket";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Play, SkipForward, Trophy, Home } from "lucide-react";
import { CountdownBar, LoadingSpinner, AnswerGrid } from "@/components/game-ui";
import confetti from "canvas-confetti";

type GameState = "lobby" | "question" | "leaderboard" | "podium";

export default function HostGame() {
  const [, params] = useRoute("/host/:gameCode");
  const [, setLocation] = useLocation();
  const gameCode = params?.gameCode || "";
  
  const { connected, lastMessage, emit } = useGameWebSocket();
  const { data: gameInfo, isLoading } = useGetGame(gameCode);
  const { data: resultsInfo } = useGetGameResults(gameCode, { query: { enabled: false } }); // Fetch imperative
  
  const [gameState, setGameState] = useState<GameState>("lobby");
  const [players, setPlayers] = useState<Array<{nickname: string, playerId: number}>>([]);
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [answersCount, setAnswersCount] = useState(0);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [correctOption, setCorrectOption] = useState<number | null>(null);
  const [timer, setTimer] = useState<number>(0);
  const [podium, setPodium] = useState<any[]>([]);

  // Join as host when connected
  useEffect(() => {
    if (connected && gameCode) {
      emit("host_join", { gameCode });
    }
  }, [connected, gameCode, emit]);

  // Handle WS Messages
  useEffect(() => {
    if (!lastMessage) return;
    const { type, payload } = lastMessage;

    switch (type) {
      case "player_joined":
        setPlayers(prev => {
          if (prev.find(p => p.playerId === payload.playerId)) return prev;
          return [...prev, { nickname: payload.nickname, playerId: payload.playerId }];
        });
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
        setLeaderboard(payload.leaderboard);
        setTimer(0);
        setTimeout(() => setGameState("leaderboard"), 3000); // Show correct answer for 3s then leaderboard
        break;

      case "game_ended":
        setGameState("podium");
        // fetch results ideally, but let's assume we get them from payload or API
        break;
    }
  }, [lastMessage]);

  // Timer logic for display only (server handles real timing)
  useEffect(() => {
    if (gameState === "question" && timer > 0) {
      const int = setInterval(() => setTimer(t => Math.max(0, t - 1)), 1000);
      return () => clearInterval(int);
    }
  }, [gameState, timer]);

  // Handle Podium Confetti
  useEffect(() => {
    if (gameState === "podium") {
      const duration = 5 * 1000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 5,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#E21B3C', '#1368CE', '#D89E00', '#26890C', '#8A2BE2']
        });
        confetti({
          particleCount: 5,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#E21B3C', '#1368CE', '#D89E00', '#26890C', '#8A2BE2']
        });

        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
    }
  }, [gameState]);


  if (isLoading) return <LoadingSpinner message="Loading Game..." />;
  if (!gameInfo) return <div>Game not found</div>;

  const handleStart = () => emit("start_game", { gameCode });
  const handleSkip = () => emit("end_question", { gameCode });
  const handleNext = () => emit("next_question", { gameCode });

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans overflow-hidden relative">
      
      {/* Dynamic Backgrounds based on state */}
      <AnimatePresence>
        {gameState === 'lobby' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-primary z-0 pointer-events-none" />
        )}
        {gameState === 'question' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-muted/30 z-0 pointer-events-none" />
        )}
        {gameState === 'leaderboard' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-secondary z-0 pointer-events-none" />
        )}
      </AnimatePresence>

      {/* LOBBY STATE */}
      {gameState === "lobby" && (
        <div className="relative z-10 flex flex-col h-screen p-6">
          <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 mb-8 flex justify-between items-center shadow-2xl border border-white/20">
            <div>
              <p className="text-primary-foreground/80 font-bold text-xl uppercase tracking-widest mb-2">Join at QuizBlast.app with PIN:</p>
              <h1 className="text-7xl md:text-9xl font-display font-black text-white tracking-widest drop-shadow-lg">{gameCode}</h1>
            </div>
            <button 
              onClick={handleStart}
              disabled={players.length === 0}
              className="game-button bg-white text-primary px-10 py-6 rounded-2xl text-3xl font-black shadow-[0_8px_0_0_rgba(0,0,0,0.2)] disabled:opacity-50"
            >
              Start
            </button>
          </div>

          <div className="flex-1 bg-white/5 backdrop-blur-sm rounded-3xl p-8 border border-white/10">
            <div className="flex items-center gap-3 text-white mb-6">
              <Users size={32} />
              <span className="text-3xl font-display font-bold">{players.length} Players</span>
            </div>
            
            <div className="flex flex-wrap gap-4">
              <AnimatePresence>
                {players.map((p) => (
                  <motion.div
                    key={p.playerId}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-white text-primary px-6 py-3 rounded-full text-xl font-bold shadow-lg"
                  >
                    {p.nickname}
                  </motion.div>
                ))}
              </AnimatePresence>
              {players.length === 0 && (
                <div className="w-full text-center text-white/50 text-2xl font-bold mt-20 animate-pulse">
                  Waiting for players to join...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* QUESTION STATE */}
      {gameState === "question" && currentQuestion && (
        <div className="relative z-10 flex flex-col h-screen">
          <header className="bg-white p-4 flex justify-between items-center shadow-sm z-20 shrink-0">
            <div className="font-bold text-muted-foreground bg-muted px-4 py-2 rounded-full">
              {questionIndex + 1} of {totalQuestions}
            </div>
            <div className="font-display font-black text-4xl text-primary drop-shadow-sm">
              {timer}
            </div>
            <button onClick={handleSkip} className="game-button bg-primary text-white px-6 py-2 rounded-xl font-bold shadow-[0_4px_0_0_hsl(var(--primary-border))]">
              Skip
            </button>
          </header>

          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center shrink-0">
            <h2 className="text-4xl md:text-6xl font-display font-black text-foreground max-w-5xl leading-tight">
              {currentQuestion.text}
            </h2>
          </div>

          <div className="w-full p-4 shrink-0">
            <div className="max-w-6xl mx-auto flex flex-col gap-6">
              <div className="flex justify-between items-end px-4">
                <div className="text-xl font-bold text-muted-foreground bg-white px-4 py-2 rounded-xl shadow-sm border border-border">
                  Answers: {answersCount} / {players.length || 1}
                </div>
              </div>
              <CountdownBar timeLimit={currentQuestion.timeLimit} timeLeft={timer} />
              <div className="h-[40vh]">
                <AnswerGrid 
                  options={currentQuestion.options} 
                  disabled={true} 
                  correctOption={correctOption ?? undefined}
                  showResults={correctOption !== null}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LEADERBOARD STATE */}
      {gameState === "leaderboard" && (
        <div className="relative z-10 flex flex-col h-screen items-center py-12 px-6">
          <div className="w-full max-w-4xl flex justify-between items-center mb-12">
            <h2 className="text-5xl font-display font-black text-foreground">Top 5</h2>
            <button onClick={handleNext} className="game-button bg-primary text-white px-8 py-4 rounded-2xl text-2xl font-black shadow-[0_6px_0_0_hsl(var(--primary-border))] flex items-center gap-2">
              Next <SkipForward />
            </button>
          </div>
          
          <div className="w-full max-w-3xl flex flex-col gap-4">
            <AnimatePresence>
              {leaderboard.slice(0, 5).map((player, idx) => (
                <motion.div 
                  key={player.nickname}
                  initial={{ x: -50, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: idx * 0.1 }}
                  className="bg-white p-6 rounded-2xl shadow-md border border-border flex justify-between items-center text-2xl font-bold"
                >
                  <div className="flex items-center gap-4">
                    <span className="w-10 text-muted-foreground">{idx + 1}.</span>
                    <span className="text-foreground">{player.nickname}</span>
                  </div>
                  <span className="text-primary">{player.score}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* PODIUM STATE */}
      {gameState === "podium" && (
        <div className="relative z-10 flex flex-col h-screen items-center justify-center bg-primary text-white p-6 overflow-hidden">
          <h1 className="text-6xl font-display font-black mb-20 drop-shadow-lg text-stroke-lg">Podium</h1>
          
          <div className="flex items-end justify-center gap-4 w-full max-w-4xl h-96">
            {/* 2nd Place */}
            {leaderboard[1] && (
              <motion.div initial={{ y: 200 }} animate={{ y: 0 }} transition={{ delay: 0.5 }} className="w-1/3 flex flex-col items-center">
                <div className="text-2xl font-bold mb-4">{leaderboard[1].nickname}</div>
                <div className="text-xl mb-2">{leaderboard[1].score}</div>
                <div className="w-full h-48 bg-quiz-blue rounded-t-xl border-t-8 border-white/20 flex justify-center pt-4 shadow-2xl">
                  <span className="text-5xl font-black opacity-50">2</span>
                </div>
              </motion.div>
            )}
            
            {/* 1st Place */}
            {leaderboard[0] && (
              <motion.div initial={{ y: 300 }} animate={{ y: 0 }} transition={{ delay: 1 }} className="w-1/3 flex flex-col items-center z-10">
                <Trophy size={48} className="text-quiz-yellow mb-4 drop-shadow-lg" />
                <div className="text-3xl font-bold mb-4">{leaderboard[0].nickname}</div>
                <div className="text-xl mb-2">{leaderboard[0].score}</div>
                <div className="w-full h-64 bg-quiz-yellow rounded-t-xl border-t-8 border-white/20 flex justify-center pt-4 shadow-2xl">
                  <span className="text-6xl font-black opacity-50">1</span>
                </div>
              </motion.div>
            )}

            {/* 3rd Place */}
            {leaderboard[2] && (
              <motion.div initial={{ y: 150 }} animate={{ y: 0 }} transition={{ delay: 0.2 }} className="w-1/3 flex flex-col items-center">
                <div className="text-2xl font-bold mb-4">{leaderboard[2].nickname}</div>
                <div className="text-xl mb-2">{leaderboard[2].score}</div>
                <div className="w-full h-40 bg-quiz-green rounded-t-xl border-t-8 border-white/20 flex justify-center pt-4 shadow-2xl">
                  <span className="text-5xl font-black opacity-50">3</span>
                </div>
              </motion.div>
            )}
          </div>
          
          <button 
            onClick={() => setLocation('/dashboard')}
            className="mt-16 game-button bg-white text-primary px-8 py-4 rounded-2xl text-2xl font-black shadow-[0_6px_0_0_rgba(0,0,0,0.2)] flex items-center gap-2"
          >
            <Home /> Dashboard
          </button>
        </div>
      )}
    </div>
  );
}
