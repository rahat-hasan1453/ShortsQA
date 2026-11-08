export type Manifest = Record<string, { file: string; durationMs: number; text: string }>;

export interface ClipIndex {
  ms(text: string): number;
  file(text: string): string;
  has(text: string): boolean;
}

/** Looks clips up by their spoken text (the manifest stores the text of every clip). */
export function makeClipIndex(manifest: Manifest): ClipIndex {
  const byText = new Map(Object.values(manifest).map((e) => [e.text, e]));
  const get = (text: string) => {
    const e = byText.get(text);
    if (!e) throw new Error(`no voice clip for "${text}"`);
    return e;
  };
  return { ms: (t) => get(t).durationMs, file: (t) => `/audio/${get(t).file}`, has: (t) => byText.has(t) };
}
