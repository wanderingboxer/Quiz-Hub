import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useListQuizzes, useCreateQuiz, useDeleteQuiz, useCreateGame } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListQuizzesQueryKey } from "@workspace/api-client-react";
import { Play, Plus, Trash2, Edit3, Settings, AlertCircle, LayoutDashboard } from "lucide-react";
import { LoadingSpinner } from "@/components/game-ui";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: quizzes, isLoading, error } = useListQuizzes();
  
  const createQuiz = useCreateQuiz({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListQuizzesQueryKey() });
        toast({ title: "Quiz created!", description: "Taking you to the editor..." });
        setLocation(`/quiz/${data.id}/edit`);
      }
    }
  });

  const deleteQuiz = useDeleteQuiz({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListQuizzesQueryKey() });
        toast({ title: "Quiz deleted" });
      }
    }
  });

  const createGame = useCreateGame({
    mutation: {
      onSuccess: (data) => {
        setLocation(`/host/${data.gameCode}`);
      },
      onError: (err: any) => {
        toast({ title: "Failed to start game", description: err.message, variant: "destructive" });
      }
    }
  });

  const handleCreateNew = () => {
    createQuiz.mutate({
      data: { title: "My Awesome Quiz", description: "A fun new quiz" }
    });
  };

  if (isLoading) return <div className="min-h-screen pt-20"><LoadingSpinner message="Loading your quizzes..." /></div>;
  if (error) return <div className="min-h-screen pt-20 flex justify-center"><div className="bg-destructive/10 text-destructive p-6 rounded-xl flex items-center gap-3"><AlertCircle /> Failed to load quizzes.</div></div>;

  return (
    <div className="min-h-screen bg-muted/30 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-border sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 cursor-pointer">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
              <LayoutDashboard className="text-white" size={20} />
            </div>
            <span className="text-2xl font-display font-black text-foreground">QuizBlast Dashboard</span>
          </Link>
          <button 
            onClick={handleCreateNew}
            disabled={createQuiz.isPending}
            className="game-button bg-primary text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-[0_4px_0_0_hsl(var(--primary-border))]"
          >
            <Plus size={20} /> Create
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-4xl font-display font-black text-foreground">Your Quizzes</h1>
            <p className="text-muted-foreground mt-2 font-medium">Manage and host your game sessions</p>
          </div>
        </div>

        {quizzes?.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-border rounded-3xl p-16 text-center flex flex-col items-center">
            <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-6">
              <Settings className="text-muted-foreground" size={40} />
            </div>
            <h2 className="text-2xl font-display font-bold text-foreground mb-2">No quizzes yet</h2>
            <p className="text-muted-foreground mb-8">Create your first quiz to get started!</p>
            <button 
              onClick={handleCreateNew}
              className="game-button bg-primary text-white px-8 py-4 rounded-xl font-bold flex items-center gap-2 shadow-[0_5px_0_0_hsl(var(--primary-border))]"
            >
              <Plus /> Create Quiz
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {quizzes?.map((quiz) => (
              <div key={quiz.id} className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden hover:shadow-xl hover:border-primary/30 transition-all group flex flex-col">
                <div className="h-32 bg-gradient-to-br from-primary/10 to-quiz-blue/10 flex items-center justify-center relative">
                  <span className="text-5xl font-display font-black text-primary/20">{quiz.questionCount}Q</span>
                  <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                    <button 
                      onClick={() => createGame.mutate({ data: { quizId: quiz.id } })}
                      className="game-button bg-quiz-green text-white w-14 h-14 rounded-full flex items-center justify-center shadow-[0_4px_0_0_#1A5C08] hover:-translate-y-1"
                      title="Host Game"
                    >
                      <Play fill="currentColor" size={24} />
                    </button>
                  </div>
                </div>
                <div className="p-6 flex-1 flex flex-col">
                  <h3 className="text-xl font-display font-bold text-foreground line-clamp-1">{quiz.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1 mb-4 flex-1 line-clamp-2">{quiz.description || "No description"}</p>
                  
                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-border">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {format(new Date(quiz.createdAt), 'MMM d, yyyy')}
                    </span>
                    <div className="flex gap-2">
                      <Link href={`/quiz/${quiz.id}/edit`}>
                        <button className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors">
                          <Edit3 size={18} />
                        </button>
                      </Link>
                      <button 
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this quiz?')) {
                            deleteQuiz.mutate({ id: quiz.id });
                          }
                        }}
                        className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
