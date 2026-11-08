import { loadClips, mixAudio, timelineTexts } from "@/engine/audio/mixer";
import { makeClipIndex, type ClipIndex, type Manifest } from "@/engine/clipIndex";
import { countries, flagsTitles, flagsVoice, themes } from "@/data";
import { buildMetadata, type Metadata } from "@/engine/metadata";
import { buildQuiz } from "@/engine/quizBuilder";
import { loadAssets, type Assets } from "@/engine/render/assets";
import { buildTimeline } from "@/engine/timeline";
import type { QuizSpec, Theme, Timeline } from "@/engine/types";
import { createRng } from "@/engine/rng";
import type { Settings } from "./components/Controls";

export interface Prepared { spec: QuizSpec; timeline: Timeline; theme: Theme; assets: Assets; metadata: Metadata; clips: ClipIndex }

let manifest: Promise<Manifest> | null = null;
const getClips = async () => makeClipIndex(await (manifest ??= fetch("/audio/manifest.json").then((r) => r.json())));

export async function prepare(s: Settings): Promise<Prepared> {
  const clips = await getClips();
  const themeId = s.themeId === "random"
    ? createRng(`${s.seed}|theme`).pick(themes.filter((t) => t.bestFor.includes("flags"))).id
    : s.themeId;
  const spec = buildQuiz({ seed: s.seed, themeId, part: s.part, useRegionTwist: s.twist, countries, themes, voice: flagsVoice, clipMs: (t) => clips.ms(t) });
  const timeline = buildTimeline(spec, { clipMs: (t) => clips.ms(t), voice: flagsVoice });
  const theme = themes.find((t) => t.id === spec.themeId)!;
  const assets = await loadAssets(theme, spec.questions.map((q) => q.iso2));
  return { spec, timeline, theme, assets, metadata: buildMetadata(spec, flagsTitles), clips };
}

export async function mixFor(p: Prepared): Promise<AudioBuffer> {
  const buffers = await loadClips(timelineTexts(p.timeline), p.clips, new OfflineAudioContext(1, 48000, 48000));
  return mixAudio(p.timeline, buffers, p.theme);
}

export const fileBase = (p: Prepared) => `flags-part${p.spec.part}-${p.spec.seed}`;
export const metadataText = (m: Metadata) => `${m.title}\n\n${m.description}\n\n${m.hashtags.join(" ")}\n\nPinned comment:\n${m.pinnedComment}\n`;
