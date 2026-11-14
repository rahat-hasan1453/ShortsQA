export type Band = "easy" | "medium" | "hard" | "impossible";

export interface Country {
  n?: number;
  iso2: string;
  name: string;
  altNames: string[];
  continent: string;
  subregion: string;
  capital: string;
  flagDifficulty: 1 | 2 | 3 | 4 | 5;
  flagLookalikes: string[];
  flagHint: string;
}

export interface VoiceLines {
  format: string;
  intro: string[];
  ask: string[];
  countdown: string[];
  revealCorrect: string[];
  transition: string[];
  difficultyUp: string[];
  outro: string[];
}

export interface Theme {
  id: string;
  name: string;
  mood: string;
  palette: Record<string, string>;
  background: { type: string; description?: string; motion?: string };
  fonts: { title: string; body: string; numbers: string };
  timer: { style: string; tickEffect?: string };
  reveal: { style: string; correctEffect?: string };
  music: { mood: string };
  bestFor: string[];
  /** Shown by "Random"; the original 15 themes stay selectable but are not featured. */
  featured?: boolean;
  /** Outlined titles: optional fill override plus stroke. */
  titleStyle?: { fill?: string; stroke: string; strokeWidth: number };
}

export type QuizKind = "flags" | "capitals" | "math" | "missing-letters" | "real-vs-fake-flag";

export interface WordItem { word: string; category: string; difficulty: number; hint?: string }

export type AnswerStyle = "open" | "options" | "list";

export interface QuizQuestion {
  index: number;
  /** Flag to show; absent for text-only quizzes (math, missing letters). */
  iso2?: string;
  /** Text shown on the card instead of a flag, and its solved form shown on reveal. */
  cardText?: string;
  cardReveal?: string;
  /** Real-or-fake quiz: the flag is shown colour-shifted by this many degrees until the reveal. */
  fakeHue?: number;
  /** How the answer is spoken when it differs from `name` (math: "fifty-six" for "56"). */
  spoken?: string;
  /** The answer (country name for flags, capital city for capitals). */
  name: string;
  /** Shown with the picture while the question is open (capitals: the country name). */
  prompt?: string;
  band: Band;
  askLineId?: string;
  countdownLineId?: string;
  revealLineId: string;
  transitionLineId?: string;
  /** Multiple choice (answerStyle "options"): four names, one of them correct. */
  options?: { names: string[]; correct: number };
}

export interface QuizSpec {
  version: 1;
  format: "flags-rapid";
  /** Which quiz this is; absent means flags. */
  quiz?: QuizKind;
  seed: string;
  themeId: string;
  part: number;
  answerStyle: AnswerStyle;
  twistRegion?: string;
  hookLineId: string;
  difficultyUpLineIds: Record<number, string>;
  outroLineId: string;
  questions: QuizQuestion[];
}

export type Cue =
  | { at: number; kind: "voice"; clips: string[] }
  | { at: number; kind: "tick" | "heartbeat" | "chime" | "whoosh" };

export interface Scene {
  kind: "hook" | "diffUp" | "timer" | "reveal" | "outro";
  start: number;
  end: number;
  q?: number;
}

export interface Timeline {
  spec: QuizSpec;
  duration: number;
  scenes: Scene[];
  cues: Cue[];
}
