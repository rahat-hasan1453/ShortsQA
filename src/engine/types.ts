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

export interface QuizQuestion {
  index: number;
  iso2: string;
  name: string;
  band: Band;
  askLineId?: string;
  countdownLineId?: string;
  revealLineId: string;
  transitionLineId?: string;
}

export interface QuizSpec {
  version: 1;
  format: "flags-rapid";
  seed: string;
  themeId: string;
  part: number;
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
