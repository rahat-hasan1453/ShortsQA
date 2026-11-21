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
import { audioDir } from "@/engine/voices";
import type { Settings } from "./components/Controls";

export interface Prepared { spec: QuizSpec; timeline: Timeline; theme: Theme; assets: Assets; metadata: Metadata; clips: ClipIndex }

const manifests = new Map<string, Promise<Manifest>>();
/** Clip index of one voice; each voice has its own folder and manifest. */
export async function getClips(voiceId: string): Promise<ClipIndex> {
  if (!manifests.has(voiceId)) {
    manifests.set(voiceId, fetch(`${audioDir(voiceId)}/manifest.json`).then((r) => {
      if (!r.ok) throw new Error(`Voice "${voiceId}" has no clips yet (run npm run tts -- --voice ${voiceId})`);
      return r.json();
    }));
  }
  try { return makeClipIndex(await manifests.get(voiceId)!, voiceId); }
  catch (e) { manifests.delete(voiceId); throw e; }
}

let shapeIds: Promise<Set<string>> | null = null;
const shapeSet = () => (shapeIds ??= fetch("/shapes.json").then((r) => r.json()).then((o: Record<string, { ok?: boolean }>) => new Set(Object.keys(o).filter((k) => o[k].ok !== false))));

export async function prepare(s: Settings): Promise<Prepared> {
  const clips = await getClips(s.voice);
  const themeId = s.themeId === "random"
    ? createRng(`${s.seed}|theme`).pick(themes.filter((t) => t.featured && t.bestFor.includes("flags"))).id
    : s.themeId;
  const voice = voiceFor(s.format);
  const spec = buildQuiz({ quiz: s.format, seed: s.seed, themeId, part: s.part, profile: s.shape, useRegionTwist: s.twist && s.format !== "math" && s.format !== "missing-letters" && s.format !== "landmarks" && s.format !== "what-is-it" && s.format !== "country-shape", shapeIso2: s.format === "country-shape" ? await shapeSet() : undefined, words, landmarks, pictures: pictures.filter((p) => clips.has(p.name)), answerStyle: s.answerStyle, countries, themes, voice, clipMs: (t) => clips.ms(t) });
  const timeline = buildTimeline(spec, { clipMs: (t) => clips.ms(t), voice });
  const theme = withFont(themes.find((t) => t.id === spec.themeId)!, s.font);
  const assets = await loadAssets(theme, spec.questions.flatMap((q) => (q.iso2 && !q.image ? [q.iso2] : [])), spec.questions.flatMap((q) => (q.iso2 && q.fakeHue ? [{ iso2: q.iso2, hue: q.fakeHue }] : [])), spec.questions.flatMap((q) => (q.image ? [q.image] : [])), spec.questions.flatMap((q) => (q.shape && q.iso2 ? [q.iso2] : [])));
  return { spec, timeline, theme, assets, metadata: buildMetadata(spec, titlesFor(s.format), timeline), clips };
}

export async function mixFor(p: Prepared): Promise<AudioBuffer> {
  const buffers = await loadClips(timelineTexts(p.timeline), p.clips, new OfflineAudioContext(1, 48000, 48000));
  return mixAudio(p.timeline, buffers, p.theme);
}

export const fileBase = (p: Prepared) => `${p.spec.profile === "long" ? "long-" : ""}${p.spec.quiz ?? "flags"}-part${p.spec.part}-${p.spec.seed}`;

/** Server-side id of a streamed render: [a-z0-9-] only; a seed that needed changing gets a short hash so "a b" and "a-b" never share a file. */
export function renderId(p: Pick<Prepared, "spec">): string {
  const raw = fileBase(p as Prepared), safe = raw.toLowerCase().replace(/[^a-z0-9-]+/g, "-").slice(0, 70);
  if (safe === raw) return safe;
  let h = 0;
  for (const ch of raw) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `${safe}-${h.toString(36)}`;
}
/** Photo credits (required by the CC licences) for the landmark photos used in a quiz. */
export const photoCredits = (spec: QuizSpec): string =>
  spec.questions.filter((q) => q.image && (landmarkCredits[q.image] ?? pictureCredits[q.image])).map((q) => { const c = (landmarkCredits[q.image!] ?? pictureCredits[q.image!]); return `${q.prompt ?? q.name}: ${c.author}, ${c.license} (${c.source})`; }).join("\n");

export const metadataText = (m: Metadata, spec?: QuizSpec) => {
  const credits = spec ? photoCredits(spec) : "";
  return `${m.title}\n\n${m.description}\n\n${m.hashtags.join(" ")}\n\nPinned comment:\n${m.pinnedComment}\n${credits ? `\nPhoto credits (add to the description):\n${credits}\n` : ""}`;
};
