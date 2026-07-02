import * as Tone from "tone";

export type InstrumentId = "retro-fm" | "warm-triangle" | "soft-pad" | "electric-lead" | "glass-synth";

export interface InstrumentPreset {
  id: InstrumentId;
  label: string;
  description: string;
}

export const INSTRUMENT_PRESETS: InstrumentPreset[] = [
  {
    id: "retro-fm",
    label: "Retro FM",
    description: "밝은 FM 신스 — 재즈·팝 코드에 잘 어울려요",
  },
  {
    id: "electric-lead",
    label: "Electric Lead",
    description: "듀오 신스 리드 — 선명하고 앞으로 나오는 톤",
  },
  {
    id: "glass-synth",
    label: "Glass Synth",
    description: "유리 같은 하이 FM — 모던·일렉트로 느낌",
  },
  {
    id: "soft-pad",
    label: "Soft Pad",
    description: "느린 어택의 패드 — 부드럽게 깔아주는 반주",
  },
  {
    id: "warm-triangle",
    label: "Warm Triangle",
    description: "soundgo와 같은 연속 삼각파 + 필터 — 기본 추천",
  },
];

export const DEFAULT_INSTRUMENT_ID: InstrumentId = "warm-triangle";

export function createChordSynth(id: InstrumentId) {
  switch (id) {
    case "retro-fm":
      return new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 2.4,
        modulationIndex: 4.5,
        oscillator: { type: "sine" },
        envelope: { attack: 0.02, decay: 0.18, sustain: 0.72, release: 0.4 },
        modulation: { type: "square" },
        modulationEnvelope: { attack: 0.01, decay: 0.12, sustain: 0.35, release: 0.25 },
      }).toDestination();

    case "electric-lead":
      return new Tone.PolySynth(Tone.DuoSynth, {
        vibratoAmount: 0.15,
        vibratoRate: 5,
        harmonicity: 1.2,
        voice0: {
          oscillator: { type: "sawtooth" },
          envelope: { attack: 0.015, decay: 0.12, sustain: 0.68, release: 0.35 },
        },
        voice1: {
          oscillator: { type: "square" },
          envelope: { attack: 0.02, decay: 0.2, sustain: 0.55, release: 0.4 },
        },
      }).toDestination();

    case "glass-synth":
      return new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 3.5,
        modulationIndex: 8,
        oscillator: { type: "sine" },
        envelope: { attack: 0.01, decay: 0.22, sustain: 0.65, release: 0.55 },
        modulation: { type: "sine" },
        modulationEnvelope: { attack: 0.005, decay: 0.15, sustain: 0.25, release: 0.35 },
      }).toDestination();

    case "soft-pad":
      return new Tone.PolySynth(Tone.AMSynth, {
        harmonicity: 2,
        oscillator: { type: "sine" },
        envelope: { attack: 0.35, decay: 0.25, sustain: 0.82, release: 0.9 },
        modulation: { type: "sine" },
        modulationEnvelope: { attack: 0.4, decay: 0.2, sustain: 0.55, release: 0.85 },
      }).toDestination();

    case "warm-triangle":
    default:
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle" },
        envelope: { attack: 0.03, decay: 0.15, sustain: 0.75, release: 0.35 },
      }).toDestination();
  }
}
