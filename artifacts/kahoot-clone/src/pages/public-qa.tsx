import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Wifi, WifiOff } from "lucide-react";
import { useGameWebSocket } from "@/hooks/use-websocket";

interface PublicQAItem {
  id: string;
  text: string;
  answer: string;
  answeredBy: string | null;
  askedAt: number;
  answeredAt: number | null;
}

const QA_CLIENT_ID_KEY = "quizblast_qa_client_id";

export default function PublicQA() {
  const { connected, lastMessage, emit } = useGameWebSocket();
  const [items, setItems] = useState<PublicQAItem[]>([]);
  const [clientId] = useState(() => {
    if (typeof window === "undefined") return "anon-display";
    const existing = sessionStorage.getItem(QA_CLIENT_ID_KEY);
    if (existing) return existing;
    const id = `display-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(QA_CLIENT_ID_KEY, id);
    return id;
  });

  // Join as anonymous client so we receive global Q&A events
  useEffect(() => {
    if (!connected || !clientId) return;
    emit("qa_client_join", { clientId });
  }, [connected, clientId, emit]);

  // Socket handler
  useEffect(() => {
    if (!lastMessage) return;
    const { type, payload } = lastMessage;

    if (type === "global_live_questions_list") {
      const questions: PublicQAItem[] = (payload?.questions || [])
        .filter((q: any) => q.isPublic && q.answer)
        .map((q: any) => ({
          id: String(q.id),
          text: String(q.text),
          answer: String(q.answer),
          answeredBy: q.answeredBy ?? null,
          askedAt: Number(q.askedAt),
          answeredAt: q.answeredAt ?? null,
        }));
      setItems(questions);
    }

    if (type === "global_qa_published") {
      const q = payload as any;
      if (!q?.id || !q?.answer) return;
      setItems((prev) => {
        if (prev.find((item) => item.id === String(q.id))) {
          return prev.map((item) =>
            item.id === String(q.id)
              ? { ...item, answer: String(q.answer), answeredBy: q.answeredBy ?? item.answeredBy, isPublic: true }
              : item
          );
        }
        return [
          ...prev,
          {
            id: String(q.id),
            text: String(q.text),
            answer: String(q.answer),
            answeredBy: q.answeredBy ?? null,
            askedAt: Number(q.askedAt),
            answeredAt: q.answeredAt ?? Date.now(),
          },
        ];
      });
    }
  }, [lastMessage]);

  return (
    <div className="min-h-screen bg-[#060D1F] text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-5 border-b border-white/10">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0054FF] to-[#5B8FFF] flex items-center justify-center shadow-lg shadow-blue-500/30">
            <MessageCircle size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-display font-black tracking-tight">Live Q&amp;A</h1>
            <p className="text-xs text-white/50 font-medium">Public answers • updated in real-time</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${connected ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25" : "bg-white/5 text-white/40 border border-white/10"}`}>
            {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
            {connected ? "Live" : "Connecting…"}
          </div>
          <div className="px-3 py-1.5 rounded-full text-xs font-bold bg-white/5 text-white/50 border border-white/10">
            {items.length} {items.length === 1 ? "answer" : "answers"}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-6 py-8 max-w-5xl mx-auto w-full">
        <AnimatePresence mode="popLayout">
          {items.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center min-h-[60vh] text-center"
            >
              <div className="w-24 h-24 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mb-6">
                <MessageCircle size={40} className="text-white/20" />
              </div>
              <h2 className="text-3xl font-display font-black text-white/30 mb-2">
                No public answers yet
              </h2>
              <p className="text-white/20 text-lg">
                Answers will appear here as the host makes them public
              </p>
              <div className="mt-8 flex gap-2">
                {[...Array(3)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 rounded-full bg-white/20"
                    animate={{ opacity: [0.2, 0.6, 0.2] }}
                    transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.3 }}
                  />
                ))}
              </div>
            </motion.div>
          ) : (
            <div className="grid gap-5">
              {[...items].reverse().map((q, i) => (
                <motion.div
                  key={q.id}
                  layout
                  initial={{ opacity: 0, y: 32, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", damping: 22, stiffness: 280, delay: i === 0 ? 0 : 0 }}
                  className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden"
                >
                  {/* Question */}
                  <div className="px-7 pt-6 pb-4">
                    <div className="flex items-start gap-3 mb-1">
                      <span className="mt-1 shrink-0 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
                        <MessageCircle size={12} className="text-white/50" />
                      </span>
                      <p className="text-lg font-semibold text-white/80 leading-snug">{q.text}</p>
                    </div>
                  </div>

                  {/* Answer */}
                  <div className="px-7 pb-6">
                    <div className="rounded-2xl bg-gradient-to-br from-[#0054FF]/20 to-[#5B8FFF]/10 border border-[#0054FF]/30 p-5">
                      <p className="text-xs font-bold uppercase tracking-widest text-[#5B8FFF] mb-3">
                        Answer
                      </p>
                      <p className="text-2xl font-display font-bold text-white leading-snug">
                        {q.answer}
                      </p>
                      {q.answeredBy && (
                        <p className="mt-3 text-sm text-white/40 font-medium">
                          — {q.answeredBy}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer branding */}
      <footer className="px-8 py-4 border-t border-white/5 text-center">
        <p className="text-xs text-white/20 font-medium">GoComet Townhall • powered by QuizBlast</p>
      </footer>
    </div>
  );
}
