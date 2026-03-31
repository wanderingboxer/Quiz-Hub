import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Home from "@/pages/home";
import Dashboard from "@/pages/dashboard";
import QA from "@/pages/qa";
import QuizEditor from "@/pages/quiz-editor";
import HostGame from "@/pages/host-game";
import PlayerGame from "@/pages/player-game";
import ResultsRedirect from "@/pages/results";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/qa" component={QA} />
      <Route path="/quiz/:id/edit" component={QuizEditor} />
      <Route path="/host/:gameCode" component={HostGame} />
      <Route path="/play/:gameCode" component={PlayerGame} />
      <Route path="/results/:gameCode" component={ResultsRedirect} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
