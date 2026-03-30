import { useEffect, useState, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { useGameWebSocket } from "@/hooks/use-websocket";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, Home, Loader2, MessageCircle, Send, X, ChevronDown } from "lucide-react";
import { AnswerGrid } from "@/components/game-ui";
import confetti from "canvas-confetti";

type PlayerState = "lobby" | "answering" | "waiting" | "result" | "podium";

interface SentQuestion {
  id: string;
  text: string;
  answer: string | null;
}

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
  const [lastResult, setLastResult] = useState<{ isCorrect: boolean; points: number; score: number; rank: number } | null>(null);
  const hasJoined = useRef(false);

  const [showQaPanel, setShowQaPanel] = useState(false);
  const [qaInput, setQaInput] = useState("");
  const [sentQuestions, setSentQuestions] = useState<SentQuestion[]>([]);
  const [newAnswerIds, setNewAnswerIds] = useState<Set<string>>(new Set());
  const [unreadAnswers, setUnreadAnswers] = useState(0);
  const qaInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!nickname) setLocation("/");
  }, [nickname, setLocation]);

  useEffect(() => {
    if (connected && gameCode && nickname && !hasJoined.current) {
      hasJoined.current = true;
      emit("player_join", { gameCode, nickname });
    }
  }, [connected, gameCode, nickname, emit]);

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

      case "live_question_sent":
        break;

      case "live_question_answered": {
        const qId = String(payload.id);
        setSentQuestions(prev =>
          prev.map(q => q.id === qId ? { ...q, answer: String(payload.answer) } : q)
        );
        setNewAnswerIds(prev => new Set([...prev, qId]));
        if (!showQaPanel) {
          setUnreadAnswers(n => n + 1);
        }
        break;
      }
    }
  }, [lastMessage]);

  const handleSelectOption = (index: number) => {
    if (selectedOption !== null || !playerId) return;
    setSelectedOption(index);
    setGameState("waiting");
    const timeToAnswer = Date.now() - questionStartTime;
    emit("submit_answer", { gameCode, playerId, questionIndex, selectedOption: index, timeToAnswer });
  };

  useEffect(() => {
    if (gameState === "result" && lastResult?.isCorrect) {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }
  }, [gameState, lastResult]);

  const handleSendQuestion = () => {
    const text = qaInput.trim();
    if (!text || !playerId) return;
    const tempId = `local-${Date.now()}`;
    setSentQuestions(prev => [...prev, { id: tempId, text, answer: null }]);
    emit("ask_question", { gameCode, text });
    setQaInput("");
  };

  const openQaPanel = () => {
    setShowQaPanel(true);
    setUnreadAnswers(0);
    setTimeout(() => qaInputRef.current?.focus(), 100);
  };

  if (!nickname) return null;

  const showQaButton = gameState !== "podium" && gameState !== "answering";

  return (
    <div className="fixed inset-0 bg-background flex flex-col font-sans overflow-hidden">

      {/* Header */}
      <header className="h-16 bg-white/90 backdrop-blur border-b border-border flex items-center justify-between px-4 z-20 shrink-0">
        <div className="font-display font-bold text-muted-foreground tracking-widest uppercase">PIN: {gameCode}</div>
        <div className="flex items-center gap-2">
          {showQaButton && (
            <button
              onClick={openQaPanel}
              className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary font-bold text-sm hover:bg-primary/20 transition-colors"
            >
              <MessageCircle size={16} />
              Ask
              {unreadAnswers > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs font-black w-5 h-5 rounded-full flex items-center justify-center">
                  {unreadAnswers}
                </span>
              )}
            </button>
          )}
          <div className="font-bold text-foreground bg-muted px-4 py-1 rounded-full">{nickname}</div>
        </div>
      </header>

      {/* LOBBY STATE */}
      {gameState === "lobby" && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-primary text-white">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
            <h1 className="text-4xl md:text-5xl font-display font-black mb-4">You're in!</h1>
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
          className={`flex-1 flex flex-col items-center justify-center p-6 text-white ${lastResult.isCorrect ? "bg-quiz-green" : "bg-quiz-red"}`}
        >
          {lastResult.isCorrect ? (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex flex-col items-center">
              <CheckCircle2 size={100} className="mb-6 drop-shadow-md" />
              <h1 className="text-5xl font-display font-black mb-2">Correct!</h1>
              <div className="text-3xl font-bold bg-black/20 px-6 py-2 rounded-full mt-4">+{lastResult.points}</div>
            </motion.div>
          ) : (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex flex-col items-center">
              <XCircle size={100} className="mb-6 drop-shadow-md" />
              <h1 className="text-5xl font-display font-black mb-2">Incorrect</h1>
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
          <div className="text-7xl mb-4">🏆</div>
          <h1 className="text-5xl font-display font-black mb-4">Game Over</h1>
          <p className="text-2xl font-bold mb-12">Check the big screen for results!</p>
          <button
            onClick={() => setLocation("/")}
            className="game-button bg-white text-primary px-8 py-4 rounded-2xl text-xl font-black shadow-[0_6px_0_0_rgba(0,0,0,0.2)] flex items-center gap-2"
          >
            <Home /> Home
          </button>
        </div>
      )}

      {/* Q&A PANEL (Slide-up sheet) */}
      <AnimatePresence>
        {showQaPanel && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setShowQaPanel(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl flex flex-col"
              style={{ maxHeight: "80vh" }}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
                <div className="flex items-center gap-2">
                  <MessageCircle size={22} className="text-primary" />
                  <h2 className="text-xl font-display font-black text-foreground">Ask the Host</h2>
                </div>
                <button onClick={() => setShowQaPanel(false)} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors">
                  <ChevronDown size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-3 min-h-0">
                {sentQuestions.length === 0 && (
                  <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
                    <MessageCircle size={48} className="text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground font-medium">No questions yet.</p>
                    <p className="text-sm text-muted-foreground/70">Type a question below to ask the host.</p>
                  </div>
                )}
                {sentQuestions.map(q => (
                  <motion.div
                    key={q.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col gap-2"
                  >
                    <div className="self-end bg-primary text-white px-4 py-2.5 rounded-2xl rounded-br-sm max-w-[85%] text-sm font-medium shadow-sm">
                      {q.text}
                    </div>
                    {q.answer && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`self-start px-4 py-2.5 rounded-2xl rounded-bl-sm max-w-[85%] text-sm font-medium shadow-sm border ${newAnswerIds.has(q.id) ? "bg-green-50 border-green-200 text-green-900" : "bg-muted border-border text-foreground"}`}
                      >
                        <span className="text-xs font-bold text-muted-foreground block mb-0.5">Host replied:</span>
                        {q.answer}
                      </motion.div>
                    )}
                    {!q.answer && (
                      <div className="self-start text-xs text-muted-foreground px-2 flex items-center gap-1">
                        <Loader2 size={12} className="animate-spin" /> Waiting for reply...
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>

              <div className="px-4 py-4 border-t border-border shrink-0">
                <div className="flex items-center gap-2 bg-muted rounded-2xl px-4 py-2 border border-border focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                  <input
                    ref={qaInputRef}
                    type="text"
                    placeholder="Ask the host something..."
                    value={qaInput}
                    onChange={e => setQaInput(e.target.value.slice(0, 200))}
                    onKeyDown={e => e.key === "Enter" && handleSendQuestion()}
                    className="flex-1 bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
                  />
                  <button
                    onClick={handleSendQuestion}
                    disabled={!qaInput.trim()}
                    className="w-8 h-8 bg-primary text-white rounded-xl flex items-center justify-center disabled:opacity-40 transition-opacity shrink-0"
                  >
                    <Send size={14} />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground text-center mt-2">{qaInput.length}/200</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
