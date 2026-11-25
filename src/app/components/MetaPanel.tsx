"use client";
import { useState } from "react";
import type { Metadata } from "@/engine/metadata";

function Box({ label, text, tall }: { label: string; text: string; tall?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked: the text can still be selected */ }
  };
  return (
    <div className="studio-metabox">
      <div className="studio-metahead"><span className="studio-muted">{label}</span><button type="button" className="studio-copy" onClick={copy} aria-label={`Copy ${label.toLowerCase()}`}>{copied ? "Copied" : "Copy"}</button></div>
      <p className={`studio-metatext${tall ? " is-tall" : ""}`} data-testid={`meta-${label.toLowerCase()}`}>{text}</p>
    </div>
  );
}

/** The YouTube title, description and tags of the current video, ready to copy (the same text goes into the .txt file on export). */
export default function MetaPanel({ metadata }: { metadata: Metadata | null }) {
  return (
    <section className="studio-card2" aria-label="Title and description">
      <h2 className="studio-h">Title &amp; Description</h2>
      <Box label="Title" text={metadata?.title ?? "…"} />
      <Box label="Description" text={metadata?.description ?? "…"} tall />
      <Box label="Tags" text={metadata ? metadata.hashtags.join(" ") : "…"} />
      <Box label="Pinned comment" text={metadata?.pinnedComment ?? "…"} />
    </section>
  );
}
