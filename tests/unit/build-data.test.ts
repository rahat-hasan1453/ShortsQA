import { describe, expect, test } from "vitest";
import {
  validateCountries,
  validateWhatIsIt,
  validateVoiceLines,
  validateTitles,
  validateThemes,
} from "../../tools/build-data/validators";
import { applyFixes } from "../../tools/build-data/merge";

const country = (iso2: string, over: Record<string, unknown> = {}) => ({
  iso2, name: iso2, altNames: [], continent: "Europe", subregion: "X", capital: "C",
  flagDifficulty: 1, flagLookalikes: [], flagHint: "h", ...over,
});

describe("validateCountries", () => {
  test("flags duplicate iso2, bad difficulty and unknown lookalike", () => {
    const issues = validateCountries([
      country("AA"), country("AA"), country("BB", { flagDifficulty: 6 }),
      country("CC", { flagLookalikes: ["ZZ"] }),
    ]);
    const rules = issues.map((i) => i.rule);
    expect(rules).toContain("duplicate-iso2");
    expect(rules).toContain("flag-difficulty");
    expect(rules).toContain("unknown-lookalike");
  });
});

const item = (n: number, answer: string, over: Record<string, unknown> = {}) => ({
  n, answer, altAnswers: [], category: "animals", difficulty: 1,
  bestFormats: ["zoom"], imageSearch: ["x"], wrongOptions: ["a", "b", "c"], ...over,
});

describe("validateWhatIsIt", () => {
  test("flags wrongOptions equal to answer or alt", () => {
    const issues = validateWhatIsIt([
      item(1, "Zebra", { wrongOptions: ["Zebra", "b", "c"] }),
      item(2, "Moose", { altAnswers: ["Elk"], wrongOptions: ["Elk", "b", "c"] }),
    ]);
    expect(issues.filter((i) => i.rule === "wrong-option-is-answer").map((i) => i.n)).toEqual([1, 2]);
  });
  test("flags the brand Frisbee as a whole word, case-insensitive", () => {
    const issues = validateWhatIsIt([item(1, "frisbee")]);
    expect(issues.some((i) => i.rule === "brand")).toBe(true);
    expect(validateWhatIsIt([item(2, "Butterscotch")]).some((i) => i.rule === "brand")).toBe(false);
  });
  test("flags duplicate answers and alt clashes", () => {
    const issues = validateWhatIsIt([
      item(1, "Kiwi Bird", { altAnswers: ["Kiwi"] }),
      item(2, "Kiwi Fruit", { altAnswers: ["Kiwi"] }),
      item(3, "kiwi bird"),
    ]);
    const rules = issues.map((i) => i.rule);
    expect(rules).toContain("alt-clash");
    expect(rules).toContain("duplicate-answer");
  });
});

describe("validateVoiceLines", () => {
  const base = {
    format: "flags", intro: Array(10).fill("Hi."), ask: Array(8).fill("Q?"),
    countdown: Array(6).fill("Go."), revealCorrect: Array(10).fill("It's {answer}!"),
    transition: Array(8).fill("Next."), difficultyUp: Array(5).fill("Hard."),
    outro: Array(10).fill("Bye."), likeCta: Array(6).fill("Like."), subscribeCta: Array(6).fill("Subscribe."), lastCta: Array(6).fill("Last."),
  };
  test("passes a clean format", () => {
    expect(validateVoiceLines([base])).toEqual([]);
  });
  test("flags zero or two {answer} and unknown placeholders", () => {
    const bad = { ...base, revealCorrect: ["Yes!", "{answer} {answer}", ...Array(8).fill("{answer}")], intro: ["{oops}", ...Array(9).fill("Hi.")] };
    const rules = validateVoiceLines([bad]).map((i) => i.rule);
    expect(rules).toContain("answer-count");
    expect(rules).toContain("placeholder");
  });
});

describe("validateTitles", () => {
  test("flags a title over 70 characters", () => {
    const bank = {
      format: "flags", titles: ["x".repeat(71), ...Array(29).fill("ok")], titlesSeries: Array(8).fill("ok"),
      descriptions: Array(12).fill("d"), pinnedComments: Array(10).fill("p"),
      hashtagSets: Array(10).fill(["#shorts", "#a", "#b"]),
    };
    expect(validateTitles([bank]).map((i) => i.rule)).toContain("title-length");
  });
});

describe("applyFixes", () => {
  test("remove drops only that alt entry on that row", () => {
    const ds = { what_is_it: [item(51, "Kiwi Bird", { altAnswers: ["Kiwi"] }), item(52, "X", { altAnswers: ["Kiwi"] })] };
    const out = applyFixes(ds, [{ file: "what_is_it", n: 51, field: "altAnswers", op: "remove", value: "Kiwi" }]);
    expect((out.what_is_it[0] as any).altAnswers).toEqual([]);
    expect((out.what_is_it[1] as any).altAnswers).toEqual(["Kiwi"]);
  });
  test("global replace without n, then alt equal to answer is deduped", () => {
    const ds = { what_is_it: [item(1, "Thermos", { altAnswers: ["Vacuum Flask"] }), item(2, "Cup", { wrongOptions: ["Thermos", "b", "c"] })] };
    const out = applyFixes(ds, [{ file: "what_is_it", op: "replace", value: "Thermos", with: "Vacuum Flask" }]);
    expect((out.what_is_it[0] as any).answer).toBe("Vacuum Flask");
    expect((out.what_is_it[0] as any).altAnswers).toEqual([]);
    expect((out.what_is_it[1] as any).wrongOptions).toContain("Vacuum Flask");
  });
  test("dropRow removes the row", () => {
    const out = applyFixes({ landmarks: [{ n: 1 }, { n: 2 }] }, [{ file: "landmarks", n: 2, op: "dropRow" }]);
    expect(out.landmarks).toEqual([{ n: 1 }]);
  });
});

describe("validateThemes", () => {
  const theme = (over: Record<string, unknown> = {}) => ({
    id: "t", name: "T", mood: "m",
    palette: { bgFrom: "#000", bgTo: "#111", card: "#fff", text: "#000", accent: "#f00", accent2: "#0f0", correct: "#0a0", wrong: "#a00" },
    background: { type: "sunburst" }, fonts: { title: "A", body: "B", numbers: "C" },
    timer: { style: "pie" }, reveal: { style: "pop" }, music: { mood: "x, 100 bpm" }, bestFor: ["flags"], ...over,
  });
  test("accepts a complete theme and flags unknown styles, missing palette keys and duplicate ids", () => {
    expect(validateThemes([theme()])).toEqual([]);
    const rules = validateThemes([
      theme({ timer: { style: "spiral" } }),
      theme({ id: "u", background: { type: "lava" } }),
      theme({ id: "v", palette: { bgFrom: "#000" } }),
      theme({ id: "w", titleStyle: { stroke: "red", strokeWidth: -2 } }),
      theme(),
    ]).map((i) => i.rule);
    for (const r of ["timer-style", "background-type", "palette", "title-style", "duplicate-id"]) expect(rules).toContain(r);
  });
});
