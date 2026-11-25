"use client";
import { useState } from "react";
import type { Metadata } from "@/engine/metadata";

function Box({ label, text, size }: { label: string; text: string; size?: "title" | "description" | "tags" }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked: the text can still be selected */ }
  };
  return (
    <div className="studio-metabox">
      <p className={`studio-metatext${size ? ` is-${size}` : ""}`} data-testid={`meta-${label.toLowerCase()}`} title={copied ? "Copied" : `Click to copy the ${label.toLowerCase()}`}
        onClick={() => { if (!window.getSelection()?.toString()) copy(); }}>{text}</p>
    </div>
  );
}

/** The YouTube title, description and tags of the current video, ready to copy (the same text goes into the .txt file on export). */
export default function MetaPanel({ metadata }: { metadata: Metadata | null }) {
  return (
    <section className="studio-card2" aria-label="Title and description">
      <h2 className="studio-h studio-h14">Title &amp; Descriptions</h2>
      <Box label="Title" size="title" text={metadata?.title ?? "Shorts title here"} />
      <Box label="Description" size="description" text={metadata?.description ?? "Shorts description here"} />
      <Box label="Tags" size="tags" text={metadata ? metadata.hashtags.join(" ") : "Tags here"} />
      <Box label="Pinned comment" text={metadata?.pinnedComment ?? "Pinned comment here"} />
    </section>
  );
}
