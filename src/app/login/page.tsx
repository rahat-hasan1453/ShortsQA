"use client";
import { useState } from "react";

/** Only same-site relative paths are followed after login. */
const safeNext = (raw: string | null) => (raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/");

export default function LoginPage() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pin }) });
      if (res.ok) { window.location.assign(safeNext(new URLSearchParams(window.location.search).get("next"))); return; }
      setError((await res.json().catch(() => null))?.error ?? "Login failed");
      setPin("");
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <form onSubmit={submit} style={{ width: "100%", maxWidth: 320, display: "grid", gap: 12, padding: 24, borderRadius: 16, border: "1px solid #8884" }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Shorts Quiz Studio</h1>
        <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>PIN
          <input type="password" inputMode="numeric" autoComplete="current-password" autoFocus value={pin}
            onChange={(e) => setPin(e.target.value)} style={{ padding: "10px 12px", fontSize: 20, letterSpacing: 4 }} />
        </label>
        <button type="submit" disabled={busy || !pin}
          style={{ padding: "12px 16px", fontSize: 16, fontWeight: 700, borderRadius: 10, border: "none", background: "#2563eb", color: "#fff", cursor: "pointer" }}>Enter</button>
        <p role="alert" style={{ margin: 0, minHeight: 20, color: "#b00020" }}>{error}</p>
      </form>
    </main>
  );
}
