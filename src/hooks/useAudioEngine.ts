"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as Tone from "tone";
import { ContinuousChordVoice } from "@/lib/chordVoice";
import {
  chordToNoteNames,
  DEFAULT_ROOT_OCTAVE,
  rootToNoteName,
  type RootOctave,
} from "@/lib/chords";
import { DEFAULT_INSTRUMENT_ID, type InstrumentId } from "@/lib/instruments";

const RELEASE_DEBOUNCE_MS = 90;

export interface AudioEngine {
  ready: boolean;
  instrumentId: InstrumentId;
  rootOctave: RootOctave;
  init: () => Promise<void>;
  setInstrument: (id: InstrumentId) => void;
  setRootOctave: (octave: RootOctave) => void;
  setHeldSound: (root: string | null, chordName: string | null) => void;
  previewChord: (chordName: string) => Promise<void>;
  playClick: (time?: number) => void;
}

function buildSoundKey(root: string | null, chordName: string | null): string | null {
  if (chordName) return `chord:${chordName}`;
  if (root) return `root:${root}`;
  return null;
}

export function useAudioEngine(
  initialInstrument: InstrumentId = DEFAULT_INSTRUMENT_ID,
  initialRootOctave: RootOctave = DEFAULT_ROOT_OCTAVE
): AudioEngine {
  const voiceRef = useRef<ContinuousChordVoice | null>(null);
  const clickRef = useRef<Tone.MembraneSynth | null>(null);
  const heldRootRef = useRef<string | null>(null);
  const heldChordRef = useRef<string | null>(null);
  const instrumentRef = useRef<InstrumentId>(initialInstrument);
  const rootOctaveRef = useRef<RootOctave>(initialRootOctave);
  const [ready, setReady] = useState(false);
  const [instrumentId, setInstrumentIdState] = useState<InstrumentId>(initialInstrument);
  const [rootOctave, setRootOctaveState] = useState<RootOctave>(initialRootOctave);

  const resolveNotes = useCallback(
    (root: string | null, chordName: string | null, octave = rootOctaveRef.current): string[] | null => {
      if (chordName) return chordToNoteNames(chordName, octave);
      if (root) {
        const note = rootToNoteName(root, octave);
        return note ? [note] : null;
      }
      return null;
    },
    []
  );

  const applyHeldSound = useCallback(
    (root: string | null, chordName: string | null) => {
      const voice = voiceRef.current;
      if (!voice) return;

      const key = buildSoundKey(root, chordName);
      const notes = resolveNotes(root, chordName);
      voice.setNotes(notes, key);
    },
    [resolveNotes]
  );

  const init = useCallback(async () => {
    if (voiceRef.current) return;
    await Tone.start();

    voiceRef.current = new ContinuousChordVoice(instrumentRef.current);

    const click = new Tone.MembraneSynth({
      pitchDecay: 0.008,
      octaves: 2,
      envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.05 },
    }).toDestination();
    click.volume.value = -18;

    clickRef.current = click;
    setReady(true);
  }, []);

  const setInstrument = useCallback(
    (id: InstrumentId) => {
      if (id === instrumentRef.current) return;
      instrumentRef.current = id;
      setInstrumentIdState(id);
      voiceRef.current?.setInstrument(id);
    },
    []
  );

  const setRootOctave = useCallback(
    (octave: RootOctave) => {
      if (octave === rootOctaveRef.current) return;
      rootOctaveRef.current = octave;
      setRootOctaveState(octave);
      applyHeldSound(heldRootRef.current, heldChordRef.current);
    },
    [applyHeldSound]
  );

  const setHeldSound = useCallback(
    (root: string | null, chordName: string | null) => {
      const voice = voiceRef.current;
      if (!voice) return;

      const nextKey = buildSoundKey(root, chordName);
      const prevKey = buildSoundKey(heldRootRef.current, heldChordRef.current);

      if (nextKey) {
        voice.cancelRelease();
        if (nextKey === prevKey) return;

        heldRootRef.current = root;
        heldChordRef.current = chordName;
        applyHeldSound(root, chordName);
        return;
      }

      if (!prevKey) return;

      heldRootRef.current = null;
      heldChordRef.current = null;
      voice.scheduleRelease(RELEASE_DEBOUNCE_MS);
    },
    [applyHeldSound]
  );

  const previewChord = useCallback(
    async (chordName: string) => {
      await init();
      const voice = voiceRef.current;
      if (!voice) return;

      if (heldRootRef.current || heldChordRef.current) return;

      const notes = resolveNotes(null, chordName);
      if (!notes) return;
      voice.preview(notes);
    },
    [init, resolveNotes]
  );

  const playClick = useCallback((time?: number) => {
    if (!clickRef.current) return;
    clickRef.current.triggerAttackRelease("C2", "16n", time);
  }, []);

  useEffect(() => {
    rootOctaveRef.current = initialRootOctave;
    setRootOctaveState(initialRootOctave);
  }, [initialRootOctave]);

  useEffect(() => {
    return () => {
      voiceRef.current?.dispose();
      clickRef.current?.dispose();
    };
  }, []);

  return {
    ready,
    instrumentId,
    rootOctave,
    init,
    setInstrument,
    setRootOctave,
    setHeldSound,
    previewChord,
    playClick,
  };
}
