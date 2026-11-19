export interface QuizFormat { id: string; name: string; blurb: string; ready: boolean }

/** Quiz types shown as cards. Only "flags" has a video engine so far. */
export const FORMATS: QuizFormat[] = [
  { id: "flags", name: "Flags", blurb: "Name 10 flags, easy to impossible", ready: true },
  { id: "capitals", name: "Capitals", blurb: "Name the capital city", ready: true },
  { id: "landmarks", name: "Landmarks", blurb: "Which country is this place in?", ready: true },
  { id: "what-is-it", name: "What is it?", blurb: "Guess the zoomed-in picture", ready: true },
  { id: "real-vs-fake-flag", name: "Real or Fake flag", blurb: "Spot the made-up flag", ready: true },
  { id: "country-shape", name: "Country shape", blurb: "Name the country by its outline", ready: false },
  { id: "math", name: "Math", blurb: "Quick mental maths", ready: true },
  { id: "missing-letters", name: "Missing letters", blurb: "Fill in the blanks", ready: true },
];
