import { useState } from "react";
import { useLocation, useSearch, Link } from "wouter";
import { motion } from "framer-motion";
import { Play, ArrowLeft } from "lucide-react";

export default function Join() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);

  const prefilledCode =
    params.get("code")?.replace(/[^A-Za-z0-9]/g, "").slice(0, 6).toUpperCase() || "";

  const [gameCode, setGameCode] = useState(prefilledCode);
  const [nickname, setNickname] = useState(
    typeof window !== "undefined"
      ? sessionStorage.getItem("quizblast_nickname") || ""
      : ""
  );

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gameCode || !nickname) return;
    sessionStorage.setItem("quizblast_nickname", nickname);
    setLocation(`/play/${gameCode}?tab=game`);
  };

  return (
    <div className="min-h-screen relative overflow-hidden px-4 py-8 sm:px-6 flex items-center justify-center">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 left-[-8%] h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-[-5rem] right-[-4%] h-80 w-80 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 w-full max-w-md"
      >
        <Link href="/">
          <button className="mb-6 flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={16} /> Back to home
          </button>
        </Link>

        <div className="glass-panel rounded-[28px] p-8 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1.5 brand-gradient" />

          <div className="mb-6 flex items-center gap-3">
            <div className="inline-flex items-center rounded-xl bg-white/80 px-3 py-2 shadow-sm border border-border">
              <img
                src={`${import.meta.env.BASE_URL}images/logo-dark.webp`}
                alt="GoComet logo"
                className="h-7 w-auto object-contain"
              />
            </div>
          </div>

          <h1 className="text-3xl font-display font-black text-foreground mb-1">Join Quiz</h1>
          <p className="text-sm text-muted-foreground mb-8">Enter the game PIN and your name to join a live session.</p>

          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground mb-2">
                Game PIN
              </label>
              <input
                type="text"
                placeholder="e.g. ABC123"
                value={gameCode}
                autoFocus={!prefilledCode}
                onChange={(e) =>
                  setGameCode(
                    e.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 6).toUpperCase()
                  )
                }
                className="w-full rounded-2xl border border-border bg-white px-5 py-4 text-center text-3xl font-display font-black tracking-[0.35em] uppercase text-foreground shadow-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/15 placeholder:text-muted-foreground/50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground mb-2">
                Your name
              </label>
              <input
                type="text"
                placeholder="Enter your name"
                value={nickname}
                autoFocus={!!prefilledCode}
                onChange={(e) => setNickname(e.target.value.slice(0, 15))}
                className="w-full rounded-2xl border border-border bg-white px-5 py-4 text-lg font-semibold text-foreground shadow-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/15 placeholder:text-muted-foreground/60"
              />
            </div>

            <button
              type="submit"
              disabled={!gameCode || !nickname}
              className="w-full game-button brand-gradient py-4 rounded-2xl text-lg font-black text-white shadow-[0_8px_24px_rgba(0,84,255,0.24)] disabled:opacity-50 mt-2 flex justify-center items-center gap-2"
            >
              <Play fill="currentColor" size={18} /> Join Session
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
