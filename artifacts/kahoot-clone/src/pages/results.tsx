// Handled entirely within host-game.tsx podium state for better integration
// This file left for explicit route matching if needed, simply redirects to home
import { useLocation } from "wouter";
import { useEffect } from "react";

export default function ResultsRedirect() {
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    setLocation("/");
  }, [setLocation]);

  return null;
}
