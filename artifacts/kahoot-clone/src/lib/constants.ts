import { Triangle, Square, Circle, Diamond } from "lucide-react";

export const ANSWER_COLORS = [
  { bg: "bg-quiz-red", shadow: "shadow-[#A3122A]", hover: "hover:bg-[#E21B3C]/90", icon: Triangle },
  { bg: "bg-quiz-blue", shadow: "shadow-[#0C4A95]", hover: "hover:bg-[#1368CE]/90", icon: Diamond },
  { bg: "bg-quiz-yellow", shadow: "shadow-[#A87B00]", hover: "hover:bg-[#D89E00]/90", icon: Circle },
  { bg: "bg-quiz-green", shadow: "shadow-[#1A5C08]", hover: "hover:bg-[#26890C]/90", icon: Square },
];

export const TIME_LIMITS = [5, 10, 20, 30, 60, 90, 120];
export const POINT_VALUES = [0, 500, 1000, 2000];
