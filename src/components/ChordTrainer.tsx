"use client";

import { useEffect, useRef, useState } from "react";
import * as Tone from "tone";
import { HandLandmarker, type HandLandmarkerResult, type NormalizedLandmark } from "@mediapipe/tasks-vision";

import { PRESET_SONGS, parseCustomProgression, type Song } from "@/lib/songs";
import { parseChord, noteSemitone, chordsEquivalent, DEFAULT_ROOT_OCTAVE, ROOT_OCTAVE_OPTIONS, type RootOctave } from "@/lib/chords";
import { ROOT_OPTIONS, QUALITY_OPTIONS } from "@/lib/wheelDefs";
import {
  buildHandMenuLayout,
  drawHandMenu,
  drawSessionHud,
  HandMenuDwell,
  isInHandMenuArea,
  pickHandMenuItem,
  pickHandMenuZone,
  HAND_MENU_DWELL_MS,
  HAND_MENU_ITEM_DWELL_MS,
  type HandMenuExpand,
} from "@/lib/handMenu";
import { pickSegment } from "@/lib/wheelMath";
import {
  createInitialGameState,
  currentTargetChordName,
  snapshotUi,
  type GameMode,
  type GameState,
  type HitMark,
  type UiSnapshot,
} from "@/lib/gameTypes";
import { DEFAULT_INSTRUMENT_ID, INSTRUMENT_PRESETS, type InstrumentId } from "@/lib/instruments";
import { loadInstrumentId, loadRootOctave, loadTutorialDone, saveInstrumentId, saveRootOctave, saveTutorialDone } from "@/lib/prefs";
import { useAudioEngine } from "@/hooks/useAudioEngine";
import { useHandTracking } from "@/hooks/useHandTracking";
import { useViewportSize } from "@/hooks/useViewportSize";

import { Timeline } from "./Timeline";
import { TutorialOverlay } from "./TutorialOverlay";
import styles from "./ChordTrainer.module.css";

const CUSTOM_ID = "custom";

function modeLabel(mode: GameMode): string {
  if (mode === "practice") return "연습";
  if (mode === "performance") return "박자";
  return "자유";
}

function songLabel(songId: string): string {
  if (songId === CUSTOM_ID) return "커스텀";
  return PRESET_SONGS.find((s) => s.id === songId)?.label.split(" ")[0] ?? "곡";
}

interface Point {
  x: number;
  y: number;
}

interface CoverRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

function computeCoverRect(videoW: number, videoH: number, canvasW: number, canvasH: number): CoverRect {
  const videoAspect = videoW / videoH;
  const canvasAspect = canvasW / canvasH;
  if (videoAspect > canvasAspect) {
    const sh = videoH;
    const sw = sh * canvasAspect;
    return { sx: (videoW - sw) / 2, sy: 0, sw, sh };
  }
  const sw = videoW;
  const sh = sw / canvasAspect;
  return { sx: 0, sy: (videoH - sh) / 2, sw, sh };
}

/** Maps a normalized (0-1) landmark to mirrored screen pixels, accounting
 * for the cover-crop applied to the video draw so hands line up exactly
 * with what's visible on screen. */
function landmarkToScreen(
  lm: NormalizedLandmark,
  videoW: number,
  videoH: number,
  cover: CoverRect,
  canvasW: number,
  canvasH: number
): Point {
  const px = lm.x * videoW;
  const py = lm.y * videoH;
  const relX = (px - cover.sx) / cover.sw;
  const relY = (py - cover.sy) / cover.sh;
  return { x: canvasW - relX * canvasW, y: relY * canvasH };
}

function drawMirroredVideoCover(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  cover: CoverRect,
  canvasW: number,
  canvasH: number
) {
  ctx.save();
  ctx.scale(-1, 1);
  ctx.drawImage(video, cover.sx, cover.sy, cover.sw, cover.sh, -canvasW, 0, canvasW, canvasH);
  ctx.restore();
}

interface WheelSegment {
  label: string;
  isTarget: boolean;
  isHover: boolean;
  isFlash: boolean;
}

function buildRootSegments(g: GameState, target: string | null): WheelSegment[] {
  const targetParsed = target ? parseChord(target) : null;
  const targetSemitone = targetParsed ? noteSemitone(targetParsed.root) : undefined;
  const flashActive = performance.now() < g.flashUntil;
  const flashParsed = flashActive && g.flashChord ? parseChord(g.flashChord) : null;
  const flashSemitone = flashParsed ? noteSemitone(flashParsed.root) : undefined;

  return ROOT_OPTIONS.map((opt) => ({
    label: opt.label,
    isTarget: targetSemitone !== undefined && opt.semitone === targetSemitone,
    isHover: g.selectedRoot === opt.label,
    isFlash: flashActive && flashSemitone !== undefined && opt.semitone === flashSemitone,
  }));
}

function buildQualitySegments(g: GameState, target: string | null): WheelSegment[] {
  const targetParsed = target ? parseChord(target) : null;
  const targetKey = targetParsed ? targetParsed.intervals.join(",") : null;
  const flashActive = performance.now() < g.flashUntil;
  const flashParsed = flashActive && g.flashChord ? parseChord(g.flashChord) : null;
  const flashKey = flashParsed ? flashParsed.intervals.join(",") : null;

  return QUALITY_OPTIONS.map((opt) => {
    const key = opt.intervals.join(",");
    return {
      label: opt.label,
      isTarget: targetKey !== null && key === targetKey,
      isHover: g.selectedQualitySuffix === opt.suffix,
      isFlash: flashActive && flashKey !== null && key === flashKey,
    };
  });
}

function canvasAngleRad(angleFromTopDeg: number): number {
  return ((angleFromTopDeg - 90) * Math.PI) / 180;
}

function drawWheelGeneric(
  ctx: CanvasRenderingContext2D,
  center: Point,
  radius: number,
  innerRadius: number,
  segments: WheelSegment[],
  flashColor: "hit" | "miss" | null,
  pulse: number
) {
  const n = segments.length;
  const seg = 360 / n;

  for (let i = 0; i < n; i++) {
    const s = segments[i];
    const startA = i * seg;
    const endA = (i + 1) * seg;
    const startRad = canvasAngleRad(startA);
    const endRad = canvasAngleRad(endA);

    ctx.beginPath();
    ctx.moveTo(center.x, center.y);
    ctx.arc(center.x, center.y, radius, startRad, endRad, false);
    ctx.closePath();

    let fill = "rgba(27,31,38,0.68)";
    if (s.isHover) fill = "rgba(139,124,246,0.3)";
    if (s.isTarget) fill = `rgba(242,179,61,${0.14 + pulse * 0.14})`;
    if (s.isFlash) fill = flashColor === "hit" ? "rgba(74,222,128,0.5)" : "rgba(255,92,114,0.5)";
    ctx.fillStyle = fill;
    ctx.fill();

    ctx.lineWidth = s.isTarget ? 2.4 : 1.2;
    ctx.strokeStyle = s.isTarget ? `rgba(242,179,61,${0.6 + pulse * 0.4})` : "rgba(245,243,238,0.2)";
    ctx.stroke();

    const midA = startA + seg / 2;
    const midRad = canvasAngleRad(midA);
    const labelR = (innerRadius + radius) / 2 + 4;
    const lx = center.x + Math.cos(midRad) * labelR;
    const ly = center.y + Math.sin(midRad) * labelR;
    ctx.save();
    ctx.fillStyle = s.isTarget ? "#F2B33D" : s.isHover ? "#C9BFFF" : "rgba(245,243,238,0.85)";
    const fontSize = Math.max(11, Math.min(17, radius * 0.16));
    ctx.font = `${s.isTarget ? 700 : 600} ${fontSize}px "Space Grotesk", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(s.label, lx, ly);
    ctx.restore();
  }

  ctx.beginPath();
  ctx.arc(center.x, center.y, innerRadius, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(11,13,16,0.78)";
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = "rgba(245,243,238,0.2)";
  ctx.stroke();
  ctx.fillStyle = "rgba(245,243,238,0.45)";
  ctx.font = '10px "JetBrains Mono", monospace';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("OFF", center.x, center.y);
}

function drawHandSkeletonMirrored(
  ctx: CanvasRenderingContext2D,
  lm: NormalizedLandmark[],
  videoW: number,
  videoH: number,
  cover: CoverRect,
  canvasW: number,
  canvasH: number
) {
  const toScreen = (p: NormalizedLandmark) => landmarkToScreen(p, videoW, videoH, cover, canvasW, canvasH);
  ctx.save();
  ctx.strokeStyle = "rgba(139,124,246,0.55)";
  ctx.lineWidth = 2;
  HandLandmarker.HAND_CONNECTIONS.forEach(({ start, end }) => {
    const a = toScreen(lm[start]);
    const b = toScreen(lm[end]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  });
  lm.forEach((p, i) => {
    const s = toScreen(p);
    ctx.beginPath();
    ctx.arc(s.x, s.y, i === 8 ? 5 : 3, 0, Math.PI * 2);
    ctx.fillStyle = i === 8 ? "#F5F3EE" : "rgba(245,243,238,0.55)";
    ctx.fill();
  });
  ctx.restore();
}

function drawCursor(ctx: CanvasRenderingContext2D, point: Point | null, hasSelection: boolean, matched: boolean) {
  if (!point) return;
  ctx.save();
  ctx.beginPath();
  ctx.arc(point.x, point.y, matched ? 14 : 11, 0, Math.PI * 2);
  ctx.strokeStyle = matched ? "#4ADE80" : hasSelection ? "#8B7CF6" : "rgba(245,243,238,0.5)";
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
  ctx.fillStyle = matched ? "#4ADE80" : hasSelection ? "#8B7CF6" : "#F5F3EE";
  ctx.fill();
  ctx.restore();
}

export function ChordTrainer() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<GameState>(createInitialGameState());
  const statusLineRef = useRef("");
  const menuExpandRef = useRef<HandMenuExpand>(null);
  const menuDwellZoneRef = useRef(new HandMenuDwell());
  const menuDwellPickRef = useRef(new HandMenuDwell());
  const menuHoverZoneRef = useRef<string | null>(null);
  const menuHoverPickRef = useRef<string | null>(null);
  const menuDwellProgressRef = useRef(0);

  const [instrumentId, setInstrumentId] = useState<InstrumentId>(DEFAULT_INSTRUMENT_ID);
  const [rootOctave, setRootOctave] = useState<RootOctave>(DEFAULT_ROOT_OCTAVE);
  const audio = useAudioEngine(instrumentId, rootOctave);
  const viewport = useViewportSize();

  const [ui, setUi] = useState<UiSnapshot>(() => snapshotUi(createInitialGameState(), ""));
  const [selectedSongId, setSelectedSongId] = useState<string>(PRESET_SONGS[0].id);
  const [customValue, setCustomValue] = useState("");
  const [bpmValue, setBpmValue] = useState<number>(PRESET_SONGS[0].bpm);
  const [startOverlayVisible, setStartOverlayVisible] = useState(true);
  const [showTutorial, setShowTutorial] = useState(true);
  const [starting, setStarting] = useState(false);
  const [mousePanelOpen, setMousePanelOpen] = useState(false);

  useEffect(() => {
    setInstrumentId(loadInstrumentId());
    setRootOctave(loadRootOctave());
    setShowTutorial(!loadTutorialDone());
  }, []);

  function handleInstrumentChange(id: InstrumentId) {
    setInstrumentId(id);
    saveInstrumentId(id);
    audio.setInstrument(id);
  }

  function handleRootOctaveChange(octave: RootOctave) {
    setRootOctave(octave);
    saveRootOctave(octave);
    audio.setRootOctave(octave);
  }

  function syncUi() {
    setUi(snapshotUi(gameRef.current, statusLineRef.current));
  }

  function setStatus(msg: string) {
    statusLineRef.current = msg;
    syncUi();
  }

  function resetStats() {
    const g = gameRef.current;
    g.score = 0;
    g.combo = 0;
    g.maxCombo = 0;
    g.hits = 0;
    g.misses = 0;
    g.practiceIndex = 0;
    g.perfIndex = -1;
    g.perfHitRegistered = false;
    g.historyMark = g.song ? g.song.chords.map(() => "" as HitMark) : [];
    syncUi();
  }

  function registerHit(index: number, name: string) {
    const g = gameRef.current;
    g.score += 100 + g.combo * 10;
    g.combo += 1;
    g.maxCombo = Math.max(g.maxCombo, g.combo);
    g.hits += 1;
    g.historyMark[index] = "hit";
    g.flashChord = name;
    g.flashColor = "hit";
    g.flashUntil = performance.now() + 320;
    syncUi();
  }

  function registerMiss(index: number, name: string) {
    const g = gameRef.current;
    g.combo = 0;
    g.misses += 1;
    g.historyMark[index] = "miss";
    g.flashChord = name;
    g.flashColor = "miss";
    g.flashUntil = performance.now() + 320;
    syncUi();
  }

  function practiceCheck() {
    const g = gameRef.current;
    if (!g.running || g.mode !== "practice" || !g.song) return;
    const idx = g.practiceIndex;
    const target = g.song.chords[idx];
    if (!target) return;
    if (chordsEquivalent(g.selectedChordName, target.name)) {
      registerHit(idx, target.name);
      g.practiceIndex += 1;
      if (g.practiceIndex >= g.song.chords.length) {
        g.practiceIndex = 0;
        g.historyMark = g.song.chords.map(() => "" as HitMark);
        setStatus("진행을 완주했어요! 다시 처음부터 🔁");
      }
    }
  }

  function performanceCheck() {
    const g = gameRef.current;
    if (!g.running || g.mode !== "performance" || !g.song) return;
    if (g.perfIndex < 0 || g.perfHitRegistered) return;
    const target = g.song.chords[g.perfIndex];
    if (!target) return;
    if (chordsEquivalent(g.selectedChordName, target.name)) {
      registerHit(g.perfIndex, target.name);
      g.perfHitRegistered = true;
    }
  }

  function onChordChange(i: number) {
    const g = gameRef.current;
    if (g.perfIndex >= 0 && !g.perfHitRegistered && g.song) {
      registerMiss(g.perfIndex, g.song.chords[g.perfIndex].name);
    }
    g.perfIndex = i;
    g.perfHitRegistered = false;
    syncUi();
  }

  function onSongEnd() {
    const g = gameRef.current;
    if (g.perfIndex >= 0 && !g.perfHitRegistered && g.song) {
      registerMiss(g.perfIndex, g.song.chords[g.perfIndex].name);
    }
    Tone.Transport.stop();
    setStatus(`완주! 점수 ${g.score} · 최대 콤보 ${g.maxCombo}`);
    g.perfIndex = -1;
    syncUi();
  }

  function schedulePerformance(song: Song) {
    Tone.Transport.stop();
    Tone.Transport.cancel();
    Tone.Transport.position = 0;
    Tone.Transport.bpm.value = song.bpm;

    const g = gameRef.current;
    g.perfIndex = -1;
    g.perfHitRegistered = false;

    const secPerBeat = 60 / song.bpm;
    let acc = 0;
    song.chords.forEach((c, i) => {
      const t = acc * secPerBeat;
      Tone.Transport.schedule((time) => {
        Tone.Draw.schedule(() => onChordChange(i), time);
      }, t);
      acc += c.beats;
    });
    const totalTime = acc * secPerBeat;
    Tone.Transport.schedule((time) => {
      Tone.Draw.schedule(() => onSongEnd(), time);
    }, totalTime);

    Tone.Transport.scheduleRepeat((time) => {
      audio.playClick(time);
      Tone.Draw.schedule(() => {
        gameRef.current.beatPulseUntil = performance.now() + 140;
      }, time);
    }, "4n");
  }

  function schedulePerformanceAndStart() {
    const g = gameRef.current;
    if (!g.song) return;
    schedulePerformance(g.song);
    Tone.Transport.start("+0.1");
  }

  function applyPresetSong(id: string) {
    const preset = PRESET_SONGS.find((p) => p.id === id);
    if (!preset) return;
    const song: Song = JSON.parse(JSON.stringify(preset));
    gameRef.current.song = song;
    setBpmValue(song.bpm);
    resetStats();
    if (gameRef.current.mode === "performance" && gameRef.current.running) {
      schedulePerformanceAndStart();
    }
  }

  function handleSelectSong(id: string) {
    setSelectedSongId(id);
    if (id !== CUSTOM_ID) applyPresetSong(id);
  }

  function handleBpmChange(bpm: number) {
    setBpmValue(bpm);
    if (gameRef.current.song) {
      gameRef.current.song = { ...gameRef.current.song, bpm };
    }
    if (gameRef.current.mode === "performance" && gameRef.current.running) {
      schedulePerformanceAndStart();
    }
  }

  function handleApplyCustom() {
    const result = parseCustomProgression(customValue.trim());
    if (!result.ok) {
      setStatus(result.error);
      return;
    }
    const song: Song = { id: CUSTOM_ID, label: "커스텀 진행", bpm: bpmValue, chords: result.chords };
    gameRef.current.song = song;
    resetStats();
    setStatus("커스텀 진행을 적용했어요.");
    if (gameRef.current.mode === "performance" && gameRef.current.running) {
      schedulePerformanceAndStart();
    }
  }

  function handleModeChange(mode: GameMode) {
    const g = gameRef.current;
    g.mode = mode;
    Tone.Transport.stop();
    Tone.Transport.cancel();
    menuExpandRef.current = null;
    resetStats();
    if (mode === "performance" && g.running && g.song) {
      schedulePerformanceAndStart();
    }
    syncUi();
  }

  function applyHandMenuPick(category: HandMenuExpand, pickId: string) {
    if (!category) return;
    if (category === "mode") {
      handleModeChange(pickId as GameMode);
    } else if (category === "song") {
      handleSelectSong(pickId);
    } else if (category === "instrument") {
      handleInstrumentChange(pickId as InstrumentId);
    } else if (category === "octave") {
      handleRootOctaveChange(Number(pickId) as RootOctave);
    }
    menuExpandRef.current = null;
    menuDwellZoneRef.current = new HandMenuDwell();
    menuDwellPickRef.current = new HandMenuDwell();
    setStatus("손으로 설정을 변경했어요");
  }

  function processHandMenu(handTips: Point[], canvasW: number) {
    const g = gameRef.current;
    const expand = menuExpandRef.current;
    const layout = buildHandMenuLayout(
      canvasW,
      expand,
      {
        mode: modeLabel(g.mode),
        song: g.mode === "freestyle" ? "—" : songLabel(selectedSongId),
        instrument: INSTRUMENT_PRESETS.find((p) => p.id === instrumentId)?.label ?? "악기",
        octave: ROOT_OCTAVE_OPTIONS.find((o) => o.value === rootOctave)?.label ?? `Oct ${rootOctave}`,
        songDisabled: g.mode === "freestyle",
      },
      PRESET_SONGS,
      INSTRUMENT_PRESETS,
      ROOT_OCTAVE_OPTIONS
    );

    const menuTip = handTips.find((tip) => isInHandMenuArea(tip.y, expand)) ?? null;
    const now = performance.now();

    if (!menuTip) {
      if (expand && handTips.every((tip) => !isInHandMenuArea(tip.y, expand))) {
        menuExpandRef.current = null;
      }
      menuHoverZoneRef.current = null;
      menuHoverPickRef.current = null;
      menuDwellProgressRef.current = 0;
      menuDwellZoneRef.current = new HandMenuDwell();
      menuDwellPickRef.current = new HandMenuDwell();
      return layout;
    }

    if (expand) {
      const pick = pickHandMenuItem(menuTip.x, menuTip.y, layout);
      const pickKey = pick?.id ?? null;
      menuHoverPickRef.current = pickKey;
      menuHoverZoneRef.current = null;
      menuDwellProgressRef.current = menuDwellPickRef.current.progress(now, pickKey, HAND_MENU_ITEM_DWELL_MS);
      if (menuDwellPickRef.current.isComplete(now, pickKey, HAND_MENU_ITEM_DWELL_MS) && pickKey) {
        applyHandMenuPick(expand, pickKey);
      }
      return layout;
    }

    const zone = pickHandMenuZone(menuTip.x, menuTip.y, layout);
    const zoneKey = zone?.id ?? null;
    menuHoverZoneRef.current = zoneKey;
    menuHoverPickRef.current = null;
    menuDwellProgressRef.current = menuDwellZoneRef.current.progress(now, zoneKey, HAND_MENU_DWELL_MS);
    if (menuDwellZoneRef.current.isComplete(now, zoneKey, HAND_MENU_DWELL_MS) && zoneKey) {
      menuExpandRef.current = zoneKey;
      menuDwellZoneRef.current = new HandMenuDwell();
      menuDwellProgressRef.current = 0;
    }

    return layout;
  }

  function handleResults(result: HandLandmarkerResult, videoEl: HTMLVideoElement) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const CW = viewport.w;
    const CH = viewport.h;
    if (CW === 0 || CH === 0) return;
    const videoW = videoEl.videoWidth;
    const videoH = videoEl.videoHeight;
    if (!videoW || !videoH) return;

    const g = gameRef.current;
    const dpr = window.devicePixelRatio || 1;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, CW, CH);

    const cover = computeCoverRect(videoW, videoH, CW, CH);
    drawMirroredVideoCover(ctx, videoEl, cover, CW, CH);

    ctx.fillStyle = "rgba(11,13,16,0.34)";
    ctx.fillRect(0, 0, CW, CH);

    const wheelRadius = Math.min(CW, CH) * 0.2;
    const innerR = wheelRadius * 0.32;
    const rootCenter: Point = { x: CW * 0.3, y: CH * 0.6 };
    const qualityCenter: Point = { x: CW * 0.7, y: CH * 0.6 };

    g.selectedRoot = null;
    g.selectedQualitySuffix = null;
    g.rootCursor = null;
    g.qualityCursor = null;

    const hands = result.landmarks ?? [];
    const withScreen = hands
      .map((lm) => ({ lm, screenX: landmarkToScreen(lm[0], videoW, videoH, cover, CW, CH).x }))
      .sort((a, b) => a.screenX - b.screenX);

    const handTips = withScreen.map(({ lm }) =>
      landmarkToScreen(lm[8], videoW, videoH, cover, CW, CH)
    );
    const menuLayout = processHandMenu(handTips, CW);
    drawHandMenu(
      ctx,
      menuLayout,
      menuHoverZoneRef.current,
      menuHoverPickRef.current,
      menuDwellProgressRef.current
    );

    if (g.running) {
      drawSessionHud(ctx, CW, {
        mode: g.mode,
        score: g.score,
        combo: g.combo,
        hits: g.hits,
        misses: g.misses,
      });
    }

    const wheelHands = withScreen.filter(({ lm }) => {
      const tip = landmarkToScreen(lm[8], videoW, videoH, cover, CW, CH);
      return !isInHandMenuArea(tip.y, menuExpandRef.current);
    });

    let rootHandLm: NormalizedLandmark[] | null = null;
    let qualityHandLm: NormalizedLandmark[] | null = null;

    if (wheelHands.length === 1) {
      const midX = (rootCenter.x + qualityCenter.x) / 2;
      if (wheelHands[0].screenX < midX) rootHandLm = wheelHands[0].lm;
      else qualityHandLm = wheelHands[0].lm;
    } else if (wheelHands.length >= 2) {
      rootHandLm = wheelHands[0].lm;
      qualityHandLm = wheelHands[wheelHands.length - 1].lm;
    }

    if (rootHandLm) {
      const tip = landmarkToScreen(rootHandLm[8], videoW, videoH, cover, CW, CH);
      g.rootCursor = tip;
      const idx = pickSegment(tip.x - rootCenter.x, tip.y - rootCenter.y, ROOT_OPTIONS.length, innerR);
      if (idx !== null) g.selectedRoot = ROOT_OPTIONS[idx].label;
    }
    if (qualityHandLm) {
      const tip = landmarkToScreen(qualityHandLm[8], videoW, videoH, cover, CW, CH);
      g.qualityCursor = tip;
      const idx = pickSegment(tip.x - qualityCenter.x, tip.y - qualityCenter.y, QUALITY_OPTIONS.length, innerR);
      if (idx !== null) g.selectedQualitySuffix = QUALITY_OPTIONS[idx].suffix;
    }

    g.selectedChordName =
      g.selectedRoot !== null && g.selectedQualitySuffix !== null
        ? g.selectedRoot + g.selectedQualitySuffix
        : null;

    audio.setHeldSound(g.selectedRoot, g.selectedChordName);

    const target = currentTargetChordName(g);
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 220);

    drawWheelGeneric(ctx, rootCenter, wheelRadius, innerR, buildRootSegments(g, target), g.flashColor, pulse);
    drawWheelGeneric(ctx, qualityCenter, wheelRadius, innerR, buildQualitySegments(g, target), g.flashColor, pulse);

    if (rootHandLm) drawHandSkeletonMirrored(ctx, rootHandLm, videoW, videoH, cover, CW, CH);
    if (qualityHandLm) drawHandSkeletonMirrored(ctx, qualityHandLm, videoW, videoH, cover, CW, CH);

    const matched = g.mode !== "freestyle" && chordsEquivalent(g.selectedChordName, target);
    drawCursor(ctx, g.rootCursor, g.selectedRoot !== null, matched);
    drawCursor(ctx, g.qualityCursor, g.selectedQualitySuffix !== null, matched);

    if (g.mode === "practice") practiceCheck();
    else if (g.mode === "performance") performanceCheck();
    else if (
      g.selectedChordName !== ui.selectedChord ||
      g.selectedRoot !== ui.selectedRoot
    ) {
      syncUi();
    }

    ctx.restore();
  }

  const handTracking = useHandTracking(handleResults);

  function stopSession() {
    handTracking.stop();
    Tone.Transport.stop();
    Tone.Transport.cancel();
    gameRef.current.running = false;
    menuExpandRef.current = null;
    setMousePanelOpen(false);
    setStartOverlayVisible(true);
    setShowTutorial(false);
    syncUi();
  }

  async function startEverything() {
    setStarting(true);
    setStatus("카메라 및 오디오 준비 중...");
    try {
      await audio.init();

      if (!gameRef.current.song && gameRef.current.mode !== "freestyle") {
        applyPresetSong(PRESET_SONGS[0].id);
        setSelectedSongId(PRESET_SONGS[0].id);
      }

      if (!videoRef.current) throw new Error("비디오 엘리먼트를 찾을 수 없어요.");
      await handTracking.start(videoRef.current);

      gameRef.current.running = true;
      resetStats();

      if (gameRef.current.mode === "performance") {
        schedulePerformanceAndStart();
      }

      setStartOverlayVisible(false);
      setStatus("");
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : String(err);
      setStatus(`카메라를 시작하지 못했어요. 브라우저 카메라 권한을 확인해주세요. (${message})`);
    } finally {
      setStarting(false);
    }
  }

  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const showCustomRow =
    mousePanelOpen && selectedSongId === CUSTOM_ID && ui.mode !== "freestyle";
  const freestyleLive =
    ui.selectedChord ?? (ui.selectedRoot ? `${ui.selectedRoot} · 루트` : "—");

  const settingsControls = (
    <>
      <select
        className={`${styles.select} font-mono`}
        value={selectedSongId}
        onChange={(e) => handleSelectSong(e.target.value)}
        disabled={ui.mode === "freestyle"}
        title="곡"
      >
        {PRESET_SONGS.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label} · {s.bpm}BPM
          </option>
        ))}
        <option value={CUSTOM_ID}>✏️ 직접 입력</option>
      </select>

      <input
        type="number"
        className={`${styles.numberInput} font-mono`}
        min={40}
        max={220}
        value={bpmValue}
        onChange={(e) => handleBpmChange(parseInt(e.target.value, 10) || bpmValue)}
        title="BPM"
        disabled={ui.mode === "freestyle"}
      />

      <select
        className={`${styles.select} font-mono`}
        value={instrumentId}
        onChange={(e) => handleInstrumentChange(e.target.value as InstrumentId)}
        title="악기"
      >
        {INSTRUMENT_PRESETS.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.label}
          </option>
        ))}
      </select>

      <select
        className={`${styles.octaveSelect} font-mono`}
        value={rootOctave}
        onChange={(e) => handleRootOctaveChange(Number(e.target.value) as RootOctave)}
        title="루트 옥타브"
      >
        {ROOT_OCTAVE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <div className={styles.modeToggle}>
        <button
          type="button"
          className={ui.mode === "practice" ? styles.active : undefined}
          onClick={() => handleModeChange("practice")}
        >
          연습
        </button>
        <button
          type="button"
          className={ui.mode === "performance" ? styles.active : undefined}
          onClick={() => handleModeChange("performance")}
        >
          박자
        </button>
        <button
          type="button"
          className={ui.mode === "freestyle" ? styles.active : undefined}
          onClick={() => handleModeChange("freestyle")}
        >
          자유
        </button>
      </div>
    </>
  );

  return (
    <div className={styles.stage}>
      <video ref={videoRef} className={styles.video} playsInline muted />
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        width={Math.max(1, viewport.w * dpr)}
        height={Math.max(1, viewport.h * dpr)}
      />

      {ui.running && (
        <>
          <div className={styles.floatingActions}>
            <button
              type="button"
              className={styles.floatingBtn}
              onClick={() => setMousePanelOpen((open) => !open)}
              title="마우스 설정"
            >
              {mousePanelOpen ? "닫기" : "설정"}
            </button>
            <button
              type="button"
              className={styles.floatingBtn}
              onClick={() => {
                setShowTutorial(true);
                stopSession();
              }}
              title="튜토리얼"
            >
              ?
            </button>
            <button type="button" className={styles.floatingBtnDanger} onClick={stopSession} title="종료">
              종료
            </button>
          </div>

          {mousePanelOpen && (
            <div className={styles.mousePanel}>
              <p className={`${styles.mousePanelTitle} font-mono`}>마우스 설정</p>
              <div className={styles.mousePanelControls}>{settingsControls}</div>
            </div>
          )}
        </>
      )}

      {showCustomRow && (
        <div className={styles.customRow}>
          <input
            type="text"
            className={`${styles.textInput} font-mono`}
            placeholder="예: G, D, Em, C, G, D, Em, C"
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
          />
          <button className={styles.applyBtn} onClick={handleApplyCustom}>
            진행 적용
          </button>
        </div>
      )}

      <div className={styles.bottomBar}>
        <div className={styles.nowRow}>
          <span className={`${styles.nowLabel} font-mono`}>
            {ui.mode === "freestyle" ? "PLAY" : "NOW"}
          </span>
          <span className={`${styles.nowChord} font-display`}>
            {ui.mode === "freestyle" ? freestyleLive : ui.target ?? "—"}
          </span>
        </div>
        {ui.mode !== "freestyle" && (
          <Timeline song={ui.song} currentIndex={ui.currentIndex} historyMark={ui.historyMark} />
        )}
        {ui.mode === "freestyle" && ui.running && (
          <p className={`${styles.freestyleHint} font-mono`}>
            상단 손 메뉴로 모드·악기·옥타브 변경 · 설정 버튼은 마우스용
          </p>
        )}
      </div>

      {startOverlayVisible && showTutorial && (
        <TutorialOverlay
          onComplete={() => {
            saveTutorialDone();
            void startEverything();
          }}
          onSkip={() => {
            saveTutorialDone();
            setShowTutorial(false);
          }}
          starting={starting}
          statusLine={ui.statusLine}
        />
      )}

      {startOverlayVisible && !showTutorial && (
        <div className={styles.startOverlay}>
          <div className={styles.startCard}>
            <p className={`${styles.startBrand} font-display`}>
              Hand<span className={styles.brandAccent}>Chord</span>
            </p>
            <h2 className={`${styles.startTitle} font-display`}>두 손으로 시작해요</h2>
            <p className={styles.startLead}>카메라만 켜면 됩니다. 곡·악기·모드는 연주 중 손 메뉴에서 바꿔요.</p>
            <button
              className={`${styles.startBtnLarge} font-display`}
              onClick={() => void startEverything()}
              disabled={starting}
            >
              {starting ? "준비 중…" : "카메라 시작"}
            </button>
            <button type="button" className={styles.tutorialLink} onClick={() => setShowTutorial(true)}>
              사용법 보기
            </button>
            {ui.statusLine ? <div className={`${styles.statusLine} font-mono`}>{ui.statusLine}</div> : null}
          </div>
        </div>
      )}
    </div>
  );
}
