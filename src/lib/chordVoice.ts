import * as Tone from "tone";
import { DEFAULT_INSTRUMENT_ID, type InstrumentId } from "./instruments";

export interface VoiceTimbre {
  waveform: OscillatorType;
  filterHz: number;
  chordGain: number;
  rootGain: number;
  rampSec: number;
  freqRampSec: number;
}

export const TIMBRE_BY_INSTRUMENT: Record<InstrumentId, VoiceTimbre> = {
  "warm-triangle": {
    waveform: "triangle",
    filterHz: 1800,
    chordGain: 0.2,
    rootGain: 0.15,
    rampSec: 0.06,
    freqRampSec: 0.12,
  },
  "soft-pad": {
    waveform: "sine",
    filterHz: 1400,
    chordGain: 0.17,
    rootGain: 0.13,
    rampSec: 0.12,
    freqRampSec: 0.18,
  },
  "retro-fm": {
    waveform: "triangle",
    filterHz: 1600,
    chordGain: 0.18,
    rootGain: 0.13,
    rampSec: 0.05,
    freqRampSec: 0.1,
  },
  "electric-lead": {
    waveform: "sawtooth",
    filterHz: 2200,
    chordGain: 0.16,
    rootGain: 0.12,
    rampSec: 0.04,
    freqRampSec: 0.08,
  },
  "glass-synth": {
    waveform: "sine",
    filterHz: 2600,
    chordGain: 0.15,
    rootGain: 0.11,
    rampSec: 0.05,
    freqRampSec: 0.1,
  },
};

function expandToVoiceFreqs(noteNames: string[]): number[] {
  if (noteNames.length === 0) return [];
  const rootMidi = Tone.Frequency(noteNames[0]).toMidi();
  const intervals = noteNames.map((name) => Tone.Frequency(name).toMidi() - rootMidi);

  while (intervals.length < 4) {
    intervals.push(intervals[intervals.length % noteNames.length] + 12);
  }

  return intervals.slice(0, 4).map((iv) => Tone.Frequency(rootMidi + iv, "midi").toFrequency());
}

/** soundgo-style always-on oscillators with smoothed gain — no plucky ADSR retriggers. */
export class ContinuousChordVoice {
  private oscs: Tone.Oscillator[] = [];
  private gain: Tone.Gain;
  private filter: Tone.Filter;
  private timbre: VoiceTimbre;
  private activeKey: string | null = null;
  private releaseTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(instrumentId: InstrumentId = DEFAULT_INSTRUMENT_ID) {
    this.timbre = TIMBRE_BY_INSTRUMENT[instrumentId];
    this.filter = new Tone.Filter(this.timbre.filterHz, "lowpass").toDestination();
    this.gain = new Tone.Gain(0).connect(this.filter);

    for (let i = 0; i < 4; i += 1) {
      const osc = new Tone.Oscillator(220, this.timbre.waveform).connect(this.gain);
      osc.start();
      this.oscs.push(osc);
    }
  }

  setInstrument(instrumentId: InstrumentId) {
    this.timbre = TIMBRE_BY_INSTRUMENT[instrumentId];
    this.filter.frequency.rampTo(this.timbre.filterHz, 0.12);
    this.oscs.forEach((osc) => {
      osc.type = this.timbre.waveform;
    });
  }

  setNotes(noteNames: string[] | null, key: string | null) {
    if (this.releaseTimer) {
      clearTimeout(this.releaseTimer);
      this.releaseTimer = null;
    }

    if (!key || !noteNames?.length) {
      if (!this.activeKey) return;
      this.gain.gain.rampTo(0, 0.08);
      this.activeKey = null;
      return;
    }

    if (key === this.activeKey) return;

    const freqs = expandToVoiceFreqs(noteNames);
    this.oscs.forEach((osc, i) => {
      osc.frequency.rampTo(freqs[i] ?? freqs[0], this.timbre.freqRampSec);
    });

    const targetGain = noteNames.length === 1 ? this.timbre.rootGain : this.timbre.chordGain;
    this.gain.gain.rampTo(targetGain, this.timbre.rampSec);
    this.activeKey = key;
  }

  scheduleRelease(delayMs: number) {
    if (this.releaseTimer) clearTimeout(this.releaseTimer);
    this.releaseTimer = setTimeout(() => {
      this.releaseTimer = null;
      this.setNotes(null, null);
    }, delayMs);
  }

  cancelRelease() {
    if (this.releaseTimer) {
      clearTimeout(this.releaseTimer);
      this.releaseTimer = null;
    }
  }

  preview(noteNames: string[], durationSec = 0.65) {
    const key = `preview:${noteNames.join(",")}`;
    this.setNotes(noteNames, key);
    setTimeout(() => {
      if (this.activeKey === key) this.setNotes(null, null);
    }, durationSec * 1000);
  }

  dispose() {
    if (this.releaseTimer) clearTimeout(this.releaseTimer);
    this.oscs.forEach((osc) => osc.dispose());
    this.gain.dispose();
    this.filter.dispose();
  }
}
