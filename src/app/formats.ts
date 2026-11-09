export interface QuizFormat { id: string; name: string; blurb: string; ready: boolean }

/** Quiz types shown as cards. Only "flags" has a video engine so far. */
export const FORMATS: QuizFormat[] = [
  { id: "flags", name: "Flags", blurb: "Name 10 flags, easy to impossible", ready: true },
  { id: "capitals", name: "Capitals", blurb: "Name the capital city", ready: false },
  { id: "landmarks", name: "Landmarks", blurb: "Which country is this place in?", ready: false },
  { id: "what-is-it", name: "What is it?", blurb: "Guess the zoomed-in picture", ready: false },
  { id: "real-vs-fake-flag", name: "Real or Fake flag", blurb: "Spot the made-up flag", ready: false },
  { id: "country-shape", name: "Country shape", blurb: "Name the country by its outline", ready: false },
  { id: "math", name: "Math", blurb: "Quick mental maths", ready: false },
  { id: "missing-letters", name: "Missing letters", blurb: "Fill in the blanks", ready: false },
];
