import voicesJson from "../../tools/tts/voices.json";

export interface VoiceDef {
  id: string;
  label: string;
  engine: "kokoro" | "chatterbox";
  /** Kokoro voice name (equals `id` for Kokoro entries). */
  voice?: string;
  /** Chatterbox reference recording to clone; absent uses the model's built-in voice. */
  refAudio?: string;
  gender: "female" | "male";
  accent: "US" | "UK";
  sampleText: string;
  default?: boolean;
}

export const VOICES = voicesJson as VoiceDef[];
export const DEFAULT_VOICE_ID = VOICES.find((v) => v.default)!.id;
export const voiceById = (id: string): VoiceDef | undefined => VOICES.find((v) => v.id === id);

/** Mixed into every clip key; "kokoro:af_heart" matches the keys of the clips made before voices had folders. */
export function voiceTag(v: VoiceDef): string {
  if (v.engine === "kokoro") return `kokoro:${v.voice}`;
  const ref = v.refAudio ? v.refAudio.split("/").pop()! : "default";
  return `chatterbox:${ref}`;
}

export const audioDir = (id: string): string => `/audio/${id}`;
