import { useEffect, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Play, Presentation, Send, Loader2, X } from "lucide-react";
import { useGameWebSocket } from "@/hooks/use-websocket";

interface HomeQAItem {
  id: string;
  text: string;
  answer: string | null;
  answeredBy: string | null;
  askedAt: number;
  answeredAt: number | null;
  isPublic: boolean;
  mine: boolean;
}

export default function Home() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);

  const prefilledCode =
    params.get("code")?.replace(/[^A-Za-z0-9]/g, "").slice(0, 6).toUpperCase() || "";

  const [activeMode, setActiveMode] = useState<"qa" | "quiz">("quiz");
  const [gameCode, setGameCode] = useState(prefilledCode);
  const [nickname, setNickname] = useState("");

  const { connected, lastMessage, emit } = useGameWebSocket();

  const QA_CLIENT_ID_KEY = "quizblast_qa_client_id";
  const [qaClientId, setQaClientId] = useState("");
  const [qaInput, setQaInput] = useState("");
  const [qaItems, setQaItems] = useState<HomeQAItem[]>([]);
  const [showQaModal, setShowQaModal] = useState(false);

  // CLIENT ID INIT
  useEffect(() => {
    if (typeof window === "undefined") return;

    const existing = sessionStorage.getItem(QA_CLIENT_ID_KEY);
    if (existing) {
      setQaClientId(existing);
      return;
    }

    const generated = `anon-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(QA_CLIENT_ID_KEY, generated);
    setQaClientId(generated);
  }, []);

  // JOIN QA SOCKET
  useEffect(() => {
    if (!connected || !qaClientId) return;
    emit("qa_client_join", { clientId: qaClientId });
  }, [connected, qaClientId, emit]);

  // SOCKET HANDLER
  useEffect(() => {
    if (!lastMessage) return;

    const { type, payload } = lastMessage;

    if (type === "global_live_questions_list") {
      const questions = payload?.questions || [];

      setQaItems(
        questions.map((q: any) => ({
          id: String(q.id),
          text: String(q.text),
          answer: q.answer ?? null,
          answeredBy: q.answeredBy ?? null,
          askedAt: Number(q.askedAt),
          answeredAt: q.answeredAt ?? null,
          isPublic: Boolean(q.isPublic),
          mine: Boolean(q.mine),
        }))
      );
    }
  }, [lastMessage]);

  // JOIN QUIZ
  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gameCode || !nickname) return;

    sessionStorage.setItem("quizblast_nickname", nickname);
    setLocation(`/play/${gameCode}?tab=game`);
  };

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-6xl mx-auto grid gap-8 lg:grid-cols-2">

        {/* LEFT SIDE */}
        <div>
          <h1 className="text-6xl font-black">GoComet Townhall</h1>

          <Link href="/dashboard">
            <button className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-xl">
              <Presentation /> Host Console
            </button>
          </Link>
        </div>

        {/* RIGHT PANEL */}
        <div className="bg-white p-6 rounded-3xl shadow">

          {/* TOGGLE */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => setActiveMode("qa")}
              className={`flex-1 p-4 rounded-xl ${activeMode === "qa" ? "bg-blue-600 text-white" : "bg-gray-100"}`}
            >
              <MessageCircle /> Q&A
            </button>

            <button
              onClick={() => setActiveMode("quiz")}
              className={`flex-1 p-4 rounded-xl ${activeMode === "quiz" ? "bg-blue-600 text-white" : "bg-gray-100"}`}
            >
              <Play /> Quiz
            </button>
          </div>

          {/* QA MODE */}
          {activeMode === "qa" && (
            <button
              onClick={() => setShowQaModal(true)}
              className="w-full py-3 bg-blue-600 text-white rounded-xl"
            >
              Open Q&A
            </button>
          )}

          {/* QUIZ MODE */}
          {activeMode === "quiz" && (
            <form onSubmit={handleJoin} className="space-y-4">
              <input
                placeholder="Game PIN"
                value={gameCode}
                onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                className="w-full p-4 border rounded-xl text-center text-2xl"
              />

              <input
                placeholder="Your Name"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full p-4 border rounded-xl"
              />

              <button
                disabled={!gameCode || !nickname}
                className="w-full py-3 bg-blue-600 text-white rounded-xl"
              >
                Join
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Q&A MODAL */}
      <AnimatePresence>
        {showQaModal && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/50">

            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-white p-6 rounded-3xl w-full max-w-md"
            >
              <button onClick={() => setShowQaModal(false)}>
                <X />
              </button>

              <div className="space-y-4 max-h-64 overflow-y-auto">
                {qaItems.map((q) => (
                  <div key={q.id}>
                    <p>{q.text}</p>
                    {q.answer && <p>{q.answer}</p>}
                  </div>
                ))}
              </div>

              <div className="flex gap-2 mt-4">
                <input
                  value={qaInput}
                  onChange={(e) => setQaInput(e.target.value)}
                  className="flex-1 border p-2 rounded"
                />

                <button
                  onClick={() => {
                    if (!qaInput) return;
                    emit("ask_global_question", { text: qaInput });
                    setQaInput("");
                  }}
                >
                  <Send />
                </button>
              </div>
            </motion.div>

          </div>
        )}
      </AnimatePresence>
    </div>
  );
}