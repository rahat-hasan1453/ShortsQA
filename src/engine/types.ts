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
  /** How recognisable the outline is (country-shape quiz). */
  shapeDifficulty?: number;
  funFact?: string;
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
  /** Spoken with the on-screen banners before questions 4 (like), 7 (subscribe) and 10 (last-question tease, save and comment). */
  likeCta?: string[];
  subscribeCta?: string[];
  lastCta?: string[];
}

import type { Look } from "./look";

export interface Theme {
  id: string;
  /** Flag size, shape and timer chosen by the user (see look.ts); absent = defaults. */
  look?: Look;
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

/** "short" = vertical 1080x1920 Shorts (10 questions, <= 59 s); "long" = 1920x1080 long-form (about 30 questions, <= 8.5 min). */
export type Profile = "short" | "long";

export type QuizKind = "flags" | "capitals" | "math" | "missing-letters" | "real-vs-fake-flag" | "landmarks" | "what-is-it" | "country-shape";

export type PictureEffect = "zoom" | "blur" | "pixel";
export interface PictureItem { id: string; name: string; category: string; difficulty: number; effects: PictureEffect[]; wrong: string[] }

export interface LandmarkItem { id: string; name: string; country: string; iso2: string; difficulty: number; distractorIso2: string[] }

export interface WordItem { word: string; category: string; difficulty: number; hint?: string }

export type AnswerStyle = "open" | "options" | "list";

export interface QuizQuestion {
  index: number;
  /** Flag to show; absent for text-only quizzes (math, missing letters). */
  iso2?: string;
  /** A fun fact read out and shown after this question's reveal ("DID YOU KNOW?"). */
  fact?: string;
  /** Country-shape quiz: draw the outline of `iso2` instead of its flag (the reveal fills it with the flag). */
  shape?: boolean;
  /** What-is-it quiz: how the photo is hidden until the reveal, and the point the zoom aims at (0..1). */
  effect?: PictureEffect;
  focus?: [number, number];
  /** Landmarks / what-is-it: id of the photo (public/landmarks/<id>.jpg) shown on the card. */
  image?: string;
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
  /** Absent means "short". */
  profile?: Profile;
  seed: string;
  themeId: string;
  part: number;
  answerStyle: AnswerStyle;
  twistRegion?: string;
  /** Set when the video is too long otherwise: the like banner is silent and the normal level-up line is spoken. */
  noLikeVoice?: boolean;
  hookLineId: string;
  difficultyUpLineIds: Record<number, string>;
  /** Voice lines for the like / subscribe / last-question banners (Shorts only; absent = the classic level-up lines). */
  ctaLineIds?: { like?: string; subscribe?: string; last?: string };
  outroLineId: string;
  questions: QuizQuestion[];
}

export type Cue =
  | { at: number; kind: "voice"; clips: string[] }
  | { at: number; kind: "tick" | "heartbeat" | "chime" | "whoosh" };

export interface Scene {
  kind: "hook" | "diffUp" | "timer" | "reveal" | "score" | "outro";
  /** Reveal scenes with a fun fact: the time at which the fact panel replaces the answer list. */
  factAt?: number;
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
