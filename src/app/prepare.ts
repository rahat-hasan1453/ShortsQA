import { loadClips, mixAudio, timelineTexts } from "@/engine/audio/mixer";
import { makeClipIndex, type ClipIndex, type Manifest } from "@/engine/clipIndex";
import { countries, landmarkCredits, landmarks, pictureCredits, pictures, themes, titlesFor, voiceFor, words } from "@/data";
import { buildMetadata, type Metadata } from "@/engine/metadata";
import { buildQuiz } from "@/engine/quizBuilder";
import { loadAssets, type Assets } from "@/engine/render/assets";
import { buildTimeline } from "@/engine/timeline";
import type { QuizSpec, Theme, Timeline } from "@/engine/types";
import { createRng } from "@/engine/rng";
import { withFont } from "@/engine/theme";
import type { Settings } from "./components/Controls";

export interface Prepared { spec: QuizSpec; timeline: Timeline; theme: Theme; assets: Assets; metadata: Metadata; clips: ClipIndex }

let manifest: Promise<Manifest> | null = null;
const getClips = async () => makeClipIndex(await (manifest ??= fetch("/audio/manifest.json").then((r) => r.json())));

export async function prepare(s: Settings): Promise<Prepared> {
  const clips = await getClips();
  const themeId = s.themeId === "random"
    ? createRng(`${s.seed}|theme`).pick(themes.filter((t) => t.featured && t.bestFor.includes("flags"))).id
    : s.themeId;
  const voice = voiceFor(s.format);
  const spec = buildQuiz({ quiz: s.format, seed: s.seed, themeId, part: s.part, useRegionTwist: s.twist && s.format !== "math" && s.format !== "missing-letters" && s.format !== "landmarks" && s.format !== "what-is-it", words, landmarks, pictures: pictures.filter((p) => clips.has(p.name)), answerStyle: s.answerStyle, countries, themes, voice, clipMs: (t) => clips.ms(t) });
  const timeline = buildTimeline(spec, { clipMs: (t) => clips.ms(t), voice });
  const theme = withFont(themes.find((t) => t.id === spec.themeId)!, s.font);
  const assets = await loadAssets(theme, spec.questions.flatMap((q) => (q.iso2 && !q.image ? [q.iso2] : [])), spec.questions.flatMap((q) => (q.iso2 && q.fakeHue ? [{ iso2: q.iso2, hue: q.fakeHue }] : [])), spec.questions.flatMap((q) => (q.image ? [q.image] : [])));
  return { spec, timeline, theme, assets, metadata: buildMetadata(spec, titlesFor(s.format)), clips };
}

export async function mixFor(p: Prepared): Promise<AudioBuffer> {
  const buffers = await loadClips(timelineTexts(p.timeline), p.clips, new OfflineAudioContext(1, 48000, 48000));
  return mixAudio(p.timeline, buffers, p.theme);
}

export const fileBase = (p: Prepared) => `${p.spec.quiz ?? "flags"}-part${p.spec.part}-${p.spec.seed}`;
/** Photo credits (required by the CC licences) for the landmark photos used in a quiz. */
export const photoCredits = (spec: QuizSpec): string =>
  spec.questions.filter((q) => q.image && (landmarkCredits[q.image] ?? pictureCredits[q.image])).map((q) => { const c = (landmarkCredits[q.image!] ?? pictureCredits[q.image!]); return `${q.prompt ?? q.name}: ${c.author}, ${c.license} (${c.source})`; }).join("\n");

export const metadataText = (m: Metadata, spec?: QuizSpec) => {
  const credits = spec ? photoCredits(spec) : "";
  return `${m.title}\n\n${m.description}\n\n${m.hashtags.join(" ")}\n\nPinned comment:\n${m.pinnedComment}\n${credits ? `\nPhoto credits (add to the description):\n${credits}\n` : ""}`;
};
