export type SlotName = "answer" | "n" | "total" | "score" | "part" | "region";
export type Segment = { kind: "text"; text: string } | { kind: "slot"; name: SlotName };

export function segmentLine(line: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  const push = (text: string) => {
    const t = text.trim().replace(/^[^A-Za-z0-9]+/, "");
    if (/[A-Za-z0-9]/.test(t)) out.push({ kind: "text", text: t });
  };
  for (const m of line.matchAll(/\{(answer|n|total|score|part|region)\}/g)) {
    push(line.slice(last, m.index));
    out.push({ kind: "slot", name: m[1] as SlotName });
    last = (m.index ?? 0) + m[0].length;
  }
  push(line.slice(last));
  return out;
}
