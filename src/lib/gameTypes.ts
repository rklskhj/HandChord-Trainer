import type { Song } from "./songs";

export type GameMode = "practice" | "performance" | "freestyle";

export type HitMark = "" | "hit" | "miss";

export interface CursorPoint {
  x: number;
  y: number;
}

/**
 * Full mutable game state. This lives in a ref inside ChordTrainer and is
 * mutated at hand-tracking frame rate (~20-30fps); a lightweight snapshot
 * (UiSnapshot) is pushed into React state only when something the UI
 * actually displays changes (hit/miss/song/mode/index changes).
 */
export interface GameState {
  mode: GameMode;
  running: boolean;
  song: Song | null;

  practiceIndex: number;
  perfIndex: number;
  perfHitRegistered: boolean;

  score: number;
  combo: number;
  maxCombo: number;
  hits: number;
  misses: number;
  historyMark: HitMark[];

  // Left hand -> root wheel, right hand -> quality wheel (assigned by
  // on-screen position each frame, not by MediaPipe's handedness label).
  selectedRoot: string | null;
  selectedQualitySuffix: string | null;
  selectedChordName: string | null; // composed root+quality, or null if incomplete

  rootCursor: CursorPoint | null;
  qualityCursor: CursorPoint | null;

  flashChord: string | null;
  flashColor: "hit" | "miss" | null;
  flashUntil: number;
  beatPulseUntil: number;
}

export interface UiSnapshot {
  song: Song | null;
  mode: GameMode;
  running: boolean;
  score: number;
  combo: number;
  maxCombo: number;
  hits: number;
  misses: number;
  target: string | null;
  selectedChord: string | null;
  selectedRoot: string | null;
  currentIndex: number;
  historyMark: HitMark[];
  statusLine: string;
}

export function createInitialGameState(): GameState {
  return {
    mode: "freestyle",
    running: false,
    song: null,
    practiceIndex: 0,
    perfIndex: -1,
    perfHitRegistered: false,
    score: 0,
    combo: 0,
    maxCombo: 0,
    hits: 0,
    misses: 0,
    historyMark: [],
    selectedRoot: null,
    selectedQualitySuffix: null,
    selectedChordName: null,
    rootCursor: null,
    qualityCursor: null,
    flashChord: null,
    flashColor: null,
    flashUntil: 0,
    beatPulseUntil: 0,
  };
}

export function currentTargetChordName(g: GameState): string | null {
  if (g.mode === "freestyle") return null;
  if (!g.song) return null;
  if (g.mode === "practice") {
    return g.song.chords[g.practiceIndex]?.name ?? null;
  }
  return g.perfIndex >= 0 ? g.song.chords[g.perfIndex]?.name ?? null : null;
}

export function currentIndexForTimeline(g: GameState): number {
  return g.mode === "practice" ? g.practiceIndex : g.perfIndex;
}

export function snapshotUi(g: GameState, statusLine: string): UiSnapshot {
  return {
    song: g.song,
    mode: g.mode,
    running: g.running,
    score: g.score,
    combo: g.combo,
    maxCombo: g.maxCombo,
    hits: g.hits,
    misses: g.misses,
    target: currentTargetChordName(g),
    selectedChord: g.selectedChordName,
    selectedRoot: g.selectedRoot,
    currentIndex: currentIndexForTimeline(g),
    historyMark: [...g.historyMark],
    statusLine,
  };
}
