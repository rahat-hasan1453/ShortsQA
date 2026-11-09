export function fitText(measure: (px: number) => number, maxWidth: number, maxPx: number, minPx: number): number {
  for (let px = maxPx; px > minPx; px -= 2) if (measure(px) <= maxWidth) return px;
  return minPx;
}

export interface TextLayout { lines: string[]; px: number; width: number }

/** One line if it fits at >= minPx; otherwise the best two-line split. Width is the widest line. */
export function layoutText(
  measureAt: (text: string, px: number) => number,
  text: string,
  maxWidth: number,
  maxPx: number,
  minPx: number,
  preferBigger = false,
): TextLayout {
  const one = fitText((px) => measureAt(text, px), maxWidth, maxPx, minPx);
  const fitsOne = measureAt(text, one) <= maxWidth;
  if (fitsOne && !preferBigger) return { lines: [text], px: one, width: measureAt(text, one) };
  const words = text.split(" ");
  const splits: string[][] = [];
  for (let i = 1; i < words.length; i++) splits.push([words.slice(0, i).join(" "), words.slice(i).join(" ")]);
  const widest = (lines: string[], px: number) => Math.max(...lines.map((l) => measureAt(l, px)));
  if (!splits.length) return { lines: [text], px: fitsOne ? one : minPx, width: measureAt(text, fitsOne ? one : minPx) };
  for (let px = maxPx; px >= minPx; px -= 2) {
    if (fitsOne && px < one * 1.25) break; // wrapping must make the text clearly bigger, otherwise stay on one line
    const best = splits.reduce((a, b) => (widest(b, px) < widest(a, px) ? b : a));
    if (widest(best, px) <= maxWidth) return { lines: best, px, width: widest(best, px) };
  }
  if (fitsOne) return { lines: [text], px: one, width: measureAt(text, one) };
  const best = splits.reduce((a, b) => (widest(b, minPx) < widest(a, minPx) ? b : a));
  return { lines: best, px: minPx, width: widest(best, minPx) };
}
