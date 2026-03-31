import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  useListQuizzes,
  useCreateQuiz,
  useDeleteQuiz,
  useCreateGame,
  getListQuizzesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Play,
  Plus,
  Trash2,
  Edit3,
  Settings,
  AlertCircle,
  MessageCircle,
  LogOut,
  Shield,
} from "lucide-react";
import { LoadingSpinner } from "@/components/game-ui";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const HOST_ACCESS_STORAGE_KEY = "quizblast_host_access_code";
const HOST_DISPLAY_NAME_STORAGE_KEY = "quizblast_host_display_name";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const apiOrigin = import.meta.env.VITE_API_ORIGIN?.trim();
  const apiUrl = (path: string) => (apiOrigin ? `${apiOrigin}${path}` : path);

  const [accessKey, setAccessKey] = useState("");
  const [hostName, setHostName] = useState(
    typeof window !== "undefined"
      ? window.sessionStorage.getItem(HOST_DISPLAY_NAME_STORAGE_KEY) || ""
      : ""
  );

  const [hasHostAccess, setHasHostAccess] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [authError, setAuthError] = useState("");

  const getStoredHostAccessCode = () =>
    typeof window !== "undefined"
      ? window.sessionStorage.getItem(HOST_ACCESS_STORAGE_KEY) || ""
      : "";

  const getHostAccessHeaders = (overrideCode?: string) => {
    const code = overrideCode ?? getStoredHostAccessCode();
    return code ? { "x-host-access-code": code } : undefined;
  };

  // ---------------- ACCESS CHECK ----------------
  useEffect(() => {
    const checkAccess = async () => {
      try {
        const res = await fetch(apiUrl("/api/host-access/status"), {
          credentials: "include",
          headers: getHostAccessHeaders(),
        });
        const data = await res.json();
        setHasHostAccess(Boolean(data.authenticated));
      } catch {
        setAuthError("Could not verify host access.");
      } finally {
        setCheckingAccess(false);
      }
    };

    checkAccess();
  }, []);

  // ---------------- QUERIES ----------------
  const { data: quizzes, error } = useListQuizzes({
    query: {
      queryKey: getListQuizzesQueryKey(),
      enabled: hasHostAccess,
    },
  });

  useEffect(() => {
    if ((error as any)?.status === 401) {
      setHasHostAccess(false);
      setAuthError("Please re-enter access code.");
      sessionStorage.removeItem(HOST_ACCESS_STORAGE_KEY);
    }
  }, [error]);

  // ---------------- MUTATIONS ----------------
  const createQuiz = useCreateQuiz({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListQuizzesQueryKey() });
        setLocation(`/quiz/${data.id}/edit`);
      },
    },
  });

  const deleteQuiz = useDeleteQuiz({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListQuizzesQueryKey() });
      },
    },
  });

  const createGame = useCreateGame();

  // ---------------- HANDLERS ----------------
  const handleCreateNew = () => {
    createQuiz.mutate({
      data: { title: "My Awesome Quiz", description: "A fun new quiz" },
    });
  };

  const handleUnlockConsole = async () => {
    if (!accessKey.trim() || !hostName.trim()) return;

    setIsUnlocking(true);
    setAuthError("");

    try {
      const res = await fetch(apiUrl("/api/host-access/login"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(getHostAccessHeaders(accessKey) ?? {}),
        },
        body: JSON.stringify({ accessKey }),
      });

      if (!res.ok) throw new Error("Invalid access code");

      sessionStorage.setItem(HOST_ACCESS_STORAGE_KEY, accessKey);
      sessionStorage.setItem(HOST_DISPLAY_NAME_STORAGE_KEY, hostName);

      setHasHostAccess(true);
      setAccessKey("");
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleLogout = async () => {
    await fetch(apiUrl("/api/host-access/logout"), {
      method: "POST",
      credentials: "include",
    });

    sessionStorage.clear();
    setHasHostAccess(false);
    setHostName("");
    setAccessKey("");
  };

  const handleLaunchSession = (quizId: number) => {
    createGame.mutate(
      { data: { quizId } },
      {
        onSuccess: (data) => {
          setLocation(`/host/${data.gameCode}`);
        },
      }
    );
  };

  // ---------------- UI STATES ----------------
  if (checkingAccess) {
    return <LoadingSpinner message="Checking host access..." />;
  }

  if (!hasHostAccess) {
    return (
      <div className="p-6 max-w-md mx-auto">
        <h2>Host Access Required</h2>

        <input
          placeholder="Name"
          value={hostName}
          onChange={(e) => setHostName(e.target.value)}
        />

        <input
          type="password"
          placeholder="Access Code"
          value={accessKey}
          onChange={(e) => setAccessKey(e.target.value)}
        />

        <button onClick={handleUnlockConsole}>
          {isUnlocking ? "Checking..." : "Unlock"}
        </button>

        {authError && <p>{authError}</p>}
      </div>
    );
  }

  // ---------------- MAIN DASHBOARD ----------------
  return (
    <div className="p-6">
      <div className="flex justify-between mb-6">
        <h1>Dashboard</h1>
        <button onClick={handleLogout}>Logout</button>
      </div>

      <button onClick={handleCreateNew}>Create Quiz</button>

      {!quizzes?.length ? (
        <p>No quizzes yet</p>
      ) : (
        <div className="grid gap-4">
          {quizzes.map((quiz) => (
            <div key={quiz.id}>
              <h3>{quiz.title}</h3>
              <p>{quiz.description}</p>

              <button onClick={() => handleLaunchSession(quiz.id)}>
                Start
              </button>

              <button
                onClick={() =>
                  deleteQuiz.mutate({ id: quiz.id })
                }
              >
                Delete
              </button>

              <Link href={`/quiz/${quiz.id}/edit`}>Edit</Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}