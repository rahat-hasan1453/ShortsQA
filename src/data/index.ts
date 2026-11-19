import countriesJson from "../../data/countries.json";
import themesJson from "../../data/themes.json";
import voiceJson from "../../data/voice_lines.json";
import titlesJson from "../../data/titles.json";
import wordsJson from "../../data/missing_letters.json";
import landmarksJson from "../../data/landmarks.json";
import whatIsItJson from "../../data/what_is_it.json";
import whatIsItCreditsJson from "../../data/what_is_it_credits.json";
import creditsJson from "../../data/landmark_credits.json";
import type { Country, LandmarkItem, PictureEffect, PictureItem, Theme, VoiceLines, WordItem } from "../engine/types";
import type { TitleBank } from "../engine/metadata";

export const countries = countriesJson as unknown as Country[];
export const themes = themesJson as unknown as Theme[];
/** Only landmarks that have a downloaded photo. */
export const landmarks = (landmarksJson as unknown as LandmarkItem[]).filter((l) => l.id in (creditsJson as Record<string, unknown>));
export const landmarkCredits = creditsJson as unknown as Record<string, { title: string; author: string; license: string; source: string }>;
/** What-is-it pictures that have a downloaded photo; wrong options are the data file's plus same-category answers. */
export const pictures: PictureItem[] = (() => {
  const raw = whatIsItJson as unknown as { n: number; answer: string; category: string; difficulty: number; bestFormats: string[]; wrongOptions: string[] }[];
  const has = whatIsItCreditsJson as Record<string, unknown>;
  const id = (n: number) => `wi${String(n).padStart(4, "0")}`;
  const ok = raw.filter((x) => id(x.n) in has);
  return ok.map((x) => ({
    id: id(x.n), name: x.answer, category: x.category, difficulty: x.difficulty,
    effects: x.bestFormats.filter((f): f is PictureEffect => f === "zoom" || f === "blur" || f === "pixel"),
    wrong: [...x.wrongOptions, ...ok.filter((y) => y.category === x.category && y.answer !== x.answer).map((y) => y.answer)],
  }));
})();
export const pictureCredits = whatIsItCreditsJson as unknown as Record<string, { title: string; author: string; license: string; source: string }>;
export const words = wordsJson as unknown as WordItem[];
export const voiceFor = (format: string) => (voiceJson as unknown as VoiceLines[]).find((v) => v.format === format)!;
export const titlesFor = (format: string) => (titlesJson as unknown as TitleBank[]).find((t) => t.format === format)!;
export const flagsVoice = (voiceJson as unknown as VoiceLines[]).find((v) => v.format === "flags")!;
export const flagsTitles = (titlesJson as unknown as TitleBank[]).find((t) => t.format === "flags")!;
