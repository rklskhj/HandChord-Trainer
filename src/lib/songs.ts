import { parseChord } from "./chords";

export interface ChordEntry {
  name: string;
  beats: number;
}

export interface Song {
  id: string;
  label: string;
  bpm: number;
  chords: ChordEntry[];
}

function bars(names: string[], beats = 4): ChordEntry[] {
  return names.map((name) => ({ name, beats }));
}

export const PRESET_SONGS: Song[] = [
  {
    id: "ballad",
    label: "여름밤 발라드 진행 (I–V–vi–IV)",
    bpm: 76,
    chords: bars(["G", "D", "Em", "C", "G", "D", "Em", "C"]),
  },
  {
    id: "citypop",
    label: "레트로 시티팝 루프 (IVmaj7–V7–iii7–vi7)",
    bpm: 98,
    chords: bars(["Fmaj7", "G7", "Em7", "Am7", "Fmaj7", "G7", "Em7", "Am7"]),
  },
  {
    id: "blues",
    label: "버스킹 블루스 12마디 (E)",
    bpm: 112,
    chords: bars(["E7", "E7", "E7", "E7", "A7", "A7", "E7", "E7", "B7", "A7", "E7", "B7"]),
  },
  {
    id: "indie",
    label: "인디락 4코드 (vi–IV–I–V)",
    bpm: 120,
    chords: bars(["Am", "F", "C", "G", "Am", "F", "C", "G"]),
  },
];

export interface CustomChordToken {
  name: string;
  beats: number;
}

/**
 * Parses a comma-separated custom progression string like:
 * "G, D, Em:2, C"  ->  chord name, optionally ":beats"
 * Returns null (with an error message) if any token fails to parse as a chord.
 */
export function parseCustomProgression(
  raw: string
): { ok: true; chords: ChordEntry[] } | { ok: false; error: string } {
  const tokens = raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    return { ok: false, error: "코드를 입력해주세요. 예: G, D, Em, C" };
  }

  const chords: ChordEntry[] = [];
  for (const tok of tokens) {
    let name = tok;
    let beats = 4;
    if (tok.includes(":")) {
      const [namePart, beatsPart] = tok.split(":");
      name = namePart.trim();
      const parsedBeats = parseInt(beatsPart, 10);
      beats = Number.isFinite(parsedBeats) && parsedBeats > 0 ? parsedBeats : 4;
    }
    const parsed = parseChord(name);
    if (!parsed) {
      return { ok: false, error: `"${name}" 코드를 인식하지 못했어요. 표기를 확인해주세요.` };
    }
    chords.push({ name, beats });
  }

  return { ok: true, chords };
}
