/**
 * Chord name parsing: turns strings like "Am7", "G", "Cmaj7", "D7", "Bb"
 * into a set of MIDI note numbers so they can be played back as audio.
 */

const NOTE_SEMITONE: Record<string, number> = {
  C: 0, "B#": 0,
  "C#": 1, Db: 1,
  D: 2,
  "D#": 3, Eb: 3,
  E: 4, Fb: 4,
  F: 5, "E#": 5,
  "F#": 6, Gb: 6,
  G: 7,
  "G#": 8, Ab: 8,
  A: 9,
  "A#": 10, Bb: 10,
  B: 11, Cb: 11,
};

interface QualityRule {
  re: RegExp;
  intervals: number[];
}

// Order matters: more specific patterns (7ths, sus, dim7...) must be
// checked before the plain "major" fallback.
const QUALITY_RULES: QualityRule[] = [
  { re: /^(maj7|Maj7|M7)$/, intervals: [0, 4, 7, 11] },
  { re: /^(m7|min7|-7)$/, intervals: [0, 3, 7, 10] },
  { re: /^(dim7|o7)$/, intervals: [0, 3, 6, 9] },
  { re: /^(dim|o)$/, intervals: [0, 3, 6] },
  { re: /^(aug|\+)$/, intervals: [0, 4, 8] },
  { re: /^(sus2)$/, intervals: [0, 2, 7] },
  { re: /^(sus4|sus)$/, intervals: [0, 5, 7] },
  { re: /^(add9)$/, intervals: [0, 4, 7, 14] },
  { re: /^(m6|min6)$/, intervals: [0, 3, 7, 9] },
  { re: /^(6)$/, intervals: [0, 4, 7, 9] },
  { re: /^(7)$/, intervals: [0, 4, 7, 10] },
  { re: /^(m|min|-)$/, intervals: [0, 3, 7] },
  { re: /^(maj|Maj|M|)$/, intervals: [0, 4, 7] }, // plain major / fallback
];

export interface ParsedChord {
  root: string;
  quality: string;
  intervals: number[];
  midiNotes: number[];
  display: string;
}


export const DEFAULT_ROOT_OCTAVE = 3;
export const MIN_ROOT_OCTAVE = 2;
export const MAX_ROOT_OCTAVE = 5;

export const ROOT_OCTAVE_OPTIONS = [
  { value: 2, label: "Oct 2", hint: "낮은 음역 · C2" },
  { value: 3, label: "Oct 3", hint: "기본 · C3" },
  { value: 4, label: "Oct 4", hint: "밝은 음역 · C4" },
  { value: 5, label: "Oct 5", hint: "높은 음역 · C5" },
] as const;

export type RootOctave = (typeof ROOT_OCTAVE_OPTIONS)[number]["value"];

export function clampRootOctave(octave: number): RootOctave {
  if (octave <= MIN_ROOT_OCTAVE) return MIN_ROOT_OCTAVE;
  if (octave >= MAX_ROOT_OCTAVE) return MAX_ROOT_OCTAVE;
  return octave as RootOctave;
}

function rootOctaveToRootMidi(rootOctave: number, rootSemitone: number): number {
  return (rootOctave + 1) * 12 + rootSemitone;
}

export function parseChord(raw: string, rootOctave: number = DEFAULT_ROOT_OCTAVE): ParsedChord | null {
  if (!raw) return null;
  const chordName = raw.trim();
  const match = chordName.match(/^([A-Ga-g])(#|b)?(.*)$/);
  if (!match) return null;

  const rootLetter = match[1].toUpperCase();
  const accidental = match[2] ?? "";
  const rest = (match[3] ?? "").trim();
  const rootKey = rootLetter + accidental;

  if (!(rootKey in NOTE_SEMITONE)) return null;
  const rootSemitone = NOTE_SEMITONE[rootKey];

  let intervals: number[] | null = null;
  for (const rule of QUALITY_RULES) {
    if (rule.re.test(rest)) {
      intervals = rule.intervals;
      break;
    }
  }
  if (!intervals) intervals = [0, 4, 7];

  const rootMidi = rootOctaveToRootMidi(rootOctave, rootSemitone);
  const midiNotes = intervals.map((iv) => rootMidi + iv);

  return { root: rootKey, quality: rest, intervals, midiNotes, display: chordName };
}

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const name = NOTE_NAMES[((midi % 12) + 12) % 12];
  return `${name}${octave}`;
}

export function chordToNoteNames(chordName: string, rootOctave: number = DEFAULT_ROOT_OCTAVE): string[] | null {
  const parsed = parseChord(chordName, rootOctave);
  if (!parsed) return null;
  return parsed.midiNotes.map(midiToNoteName);
}

/** Single root letter (e.g. "C", "F#") at the configured octave. */
export function rootToNoteName(root: string, rootOctave: number = DEFAULT_ROOT_OCTAVE): string | null {
  const semitone = NOTE_SEMITONE[root];
  if (semitone === undefined) return null;
  return midiToNoteName(rootOctaveToRootMidi(rootOctave, semitone));
}

/** Semitone (0-11) of a bare note letter like "C", "F#", "Bb". */
export function noteSemitone(note: string): number | undefined {
  return NOTE_SEMITONE[note];
}

/**
 * Compares two chord names for musical equivalence (same pitch classes),
 * not string equality — so "Bb7" and a wheel-composed "A#7" still match.
 */
export function chordsEquivalent(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const pa = parseChord(a);
  const pb = parseChord(b);
  if (!pa || !pb) return false;
  return pa.midiNotes.join(",") === pb.midiNotes.join(",");
}
