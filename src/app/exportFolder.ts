/** Where exports go: a folder the user picks once (remembered), with one numbered sub-folder per video (001, 002, ...). */

const DB = "shortsqa-export", STORE = "handles", KEY = "folder", SERIAL_KEY = "shortsqa:export-serial";

const open = () => new Promise<IDBDatabase>((resolve, reject) => {
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => r.result.createObjectStore(STORE);
  r.onsuccess = () => resolve(r.result);
  r.onerror = () => reject(r.error);
});

async function idb<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  try {
    const db = await open();
    return await new Promise<T>((resolve, reject) => { const r = run(db.transaction(STORE, mode).objectStore(STORE)); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
  } catch { return undefined; }
}

export const canPickFolder = () => typeof window !== "undefined" && "showDirectoryPicker" in window;
export const pad = (n: number) => String(n).padStart(3, "0");

/** The remembered folder, if it is still allowed (asks the browser again when needed; call from a click). */
export async function rememberedFolder(ask: boolean): Promise<FileSystemDirectoryHandle | null> {
  const h = await idb<FileSystemDirectoryHandle>("readonly", (s) => s.get(KEY));
  if (!h) return null;
  const opts = { mode: "readwrite" as const };
  if ((await h.queryPermission?.(opts)) === "granted") return h;
  if (ask && (await h.requestPermission?.(opts)) === "granted") return h;
  return null;
}

/** Opens the folder picker and remembers the choice. Throws an AbortError when cancelled. */
export async function pickFolder(): Promise<FileSystemDirectoryHandle> {
  const h = await window.showDirectoryPicker!({ id: "shortsqa-export", mode: "readwrite" });
  await idb("readwrite", (s) => s.put(h, KEY));
  return h;
}

/** The next free serial in the folder: one more than the highest numbered entry (001, 002, ...). */
export async function nextSerial(dir: FileSystemDirectoryHandle): Promise<number> {
  let max = 0;
  for await (const name of dir.keys()) { const m = /^(\d+)(?:\D|$)/.exec(name); if (m) max = Math.max(max, Number(m[1])); }
  return max + 1;
}

/** Serial for plain browser downloads (no folder access): counts up on this browser. */
export function nextDownloadSerial(): number {
  let n = 0;
  try { n = Number(localStorage.getItem(SERIAL_KEY)) || 0; } catch { /* storage blocked: start at 1 */ }
  return n + 1;
}
export function commitDownloadSerial(n: number) { try { localStorage.setItem(SERIAL_KEY, String(n)); } catch { /* nothing to remember */ } }

/** Writes one file (a Blob, or a stream for big videos) into `dir`. */
export async function writeFile(dir: FileSystemDirectoryHandle, name: string, data: Blob | ReadableStream<Uint8Array>) {
  const w = await (await dir.getFileHandle(name, { create: true })).createWritable();
  if (data instanceof Blob) { await w.write(data); await w.close(); }
  else await data.pipeTo(w);
}
