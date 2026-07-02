"use client";

import dynamic from "next/dynamic";

// MediaPipe / Tone.js touch window, navigator.mediaDevices, canvas, etc.
// so the trainer must be client-only — never rendered on the server.
const ChordTrainer = dynamic(
  () => import("@/components/ChordTrainer").then((m) => m.ChordTrainer),
  { ssr: false }
);

export default function Home() {
  return <ChordTrainer />;
}
