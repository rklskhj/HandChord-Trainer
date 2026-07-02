import { DEFAULT_INSTRUMENT_ID, type InstrumentId } from "@/lib/instruments";
import { clampRootOctave, DEFAULT_ROOT_OCTAVE, type RootOctave } from "@/lib/chords";

const INSTRUMENT_KEY = "handchord-instrument";
const ROOT_OCTAVE_KEY = "handchord-root-octave";
const TUTORIAL_KEY = "handchord-tutorial-done";

export function loadInstrumentId(): InstrumentId {
  if (typeof window === "undefined") return DEFAULT_INSTRUMENT_ID;
  const raw = window.localStorage.getItem(INSTRUMENT_KEY);
  if (
    raw === "retro-fm" ||
    raw === "warm-triangle" ||
    raw === "soft-pad" ||
    raw === "electric-lead" ||
    raw === "glass-synth"
  ) {
    return raw;
  }
  return DEFAULT_INSTRUMENT_ID;
}

export function saveInstrumentId(id: InstrumentId): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(INSTRUMENT_KEY, id);
}

export function loadRootOctave(): RootOctave {
  if (typeof window === "undefined") return DEFAULT_ROOT_OCTAVE;
  const raw = window.localStorage.getItem(ROOT_OCTAVE_KEY);
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return clampRootOctave(Number.isFinite(parsed) ? parsed : DEFAULT_ROOT_OCTAVE);
}

export function saveRootOctave(octave: RootOctave): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ROOT_OCTAVE_KEY, String(octave));
}

export function loadTutorialDone(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(TUTORIAL_KEY) === "1";
}

export function saveTutorialDone(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TUTORIAL_KEY, "1");
}
