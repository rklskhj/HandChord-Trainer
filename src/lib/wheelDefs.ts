/**
 * The two-hand wheel is fixed, not derived from the song: the left hand
 * always picks a root note (natural notes only — sharps/flats aren't
 * reachable on this wheel), the right hand always picks a chord quality.
 * Combining root + quality composes a chord name (e.g. "D" + "m7" -> "Dm7").
 */

export interface RootOption {
  label: string; // also the composed-chord prefix
  semitone: number;
}

export const ROOT_OPTIONS: RootOption[] = [
  { label: "C", semitone: 0 },
  { label: "D", semitone: 2 },
  { label: "E", semitone: 4 },
  { label: "F", semitone: 5 },
  { label: "G", semitone: 7 },
  { label: "A", semitone: 9 },
  { label: "B", semitone: 11 },
];

export interface QualityOption {
  label: string; // shown on the wheel
  suffix: string; // appended to the root to compose a chord name
  intervals: number[]; // used to match against a song's target chord regardless of spelling
}

export const QUALITY_OPTIONS: QualityOption[] = [
  { label: "maj", suffix: "", intervals: [0, 4, 7] },
  { label: "m", suffix: "m", intervals: [0, 3, 7] },
  { label: "7", suffix: "7", intervals: [0, 4, 7, 10] },
  { label: "maj7", suffix: "maj7", intervals: [0, 4, 7, 11] },
  { label: "m7", suffix: "m7", intervals: [0, 3, 7, 10] },
  { label: "dim", suffix: "dim", intervals: [0, 3, 6] },
  { label: "sus4", suffix: "sus4", intervals: [0, 5, 7] },
  { label: "aug", suffix: "aug", intervals: [0, 4, 8] },
];
