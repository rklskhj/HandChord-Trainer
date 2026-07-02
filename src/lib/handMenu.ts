import type { GameMode } from "./gameTypes";
import type { InstrumentId } from "./instruments";
import type { RootOctave } from "./chords";
import type { Song } from "./songs";

export const HAND_MENU_TOP = 10;
export const HAND_MENU_HEIGHT = 64;
export const HAND_MENU_EXPANDED_HEIGHT = 58;
export const HAND_MENU_DWELL_MS = 520;
export const HAND_MENU_ITEM_DWELL_MS = 420;

export type HandMenuExpand = "mode" | "song" | "instrument" | "octave" | null;

export type HandMenuZoneId = "mode" | "song" | "instrument" | "octave";

export interface HandMenuZone {
  id: HandMenuZoneId;
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  value: string;
  disabled?: boolean;
}

export interface HandMenuPick {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface HandMenuLayout {
  zones: HandMenuZone[];
  picks: HandMenuPick[];
  expand: HandMenuExpand;
}

export interface HandMenuLabels {
  mode: string;
  song: string;
  instrument: string;
  octave: string;
  modeDisabled?: boolean;
  songDisabled?: boolean;
}

function zoneRow(canvasW: number, count: number, leftPad: number, rightPad: number) {
  const totalW = canvasW - leftPad - rightPad;
  const gap = 6;
  const zoneW = (totalW - gap * (count - 1)) / count;
  return { leftPad, zoneW, gap, top: HAND_MENU_TOP, height: HAND_MENU_HEIGHT };
}

export function buildHandMenuLayout(
  canvasW: number,
  expand: HandMenuExpand,
  labels: HandMenuLabels,
  songOptions: Song[],
  instrumentOptions: { id: InstrumentId; label: string }[],
  octaveOptions: ReadonlyArray<{ value: RootOctave; label: string }>
): HandMenuLayout {
  const leftPad = 14;
  const rightPad = 132;
  const row = zoneRow(canvasW, 4, leftPad, rightPad);

  const zones: HandMenuZone[] = [
    {
      id: "mode",
      x: row.leftPad,
      y: row.top,
      w: row.zoneW,
      h: row.height,
      title: "모드",
      value: labels.mode,
    },
    {
      id: "song",
      x: row.leftPad + (row.zoneW + row.gap),
      y: row.top,
      w: row.zoneW,
      h: row.height,
      title: "곡",
      value: labels.song,
      disabled: labels.songDisabled,
    },
    {
      id: "instrument",
      x: row.leftPad + (row.zoneW + row.gap) * 2,
      y: row.top,
      w: row.zoneW,
      h: row.height,
      title: "악기",
      value: labels.instrument,
    },
    {
      id: "octave",
      x: row.leftPad + (row.zoneW + row.gap) * 3,
      y: row.top,
      w: row.zoneW,
      h: row.height,
      title: "옥타브",
      value: labels.octave,
    },
  ];

  const picks: HandMenuPick[] = [];
  const expandedY = row.top + row.height + 8;

  if (expand === "mode") {
    const modes: { id: GameMode; label: string }[] = [
      { id: "practice", label: "연습" },
      { id: "performance", label: "박자" },
      { id: "freestyle", label: "자유" },
    ];
    layoutPicks(picks, canvasW, leftPad, rightPad, expandedY, modes.map((m) => ({ id: m.id, label: m.label })));
  } else if (expand === "song") {
    layoutPicks(
      picks,
      canvasW,
      leftPad,
      rightPad,
      expandedY,
      songOptions.map((s) => ({ id: s.id, label: s.label.split(" ")[0] }))
    );
  } else if (expand === "instrument") {
    layoutPicks(
      picks,
      canvasW,
      leftPad,
      rightPad,
      expandedY,
      instrumentOptions.map((i) => ({ id: i.id, label: i.label }))
    );
  } else if (expand === "octave") {
    layoutPicks(
      picks,
      canvasW,
      leftPad,
      rightPad,
      expandedY,
      octaveOptions.map((o) => ({ id: String(o.value), label: o.label }))
    );
  }

  return { zones, picks, expand };
}

function layoutPicks(
  picks: HandMenuPick[],
  canvasW: number,
  leftPad: number,
  rightPad: number,
  top: number,
  items: { id: string; label: string }[]
) {
  const gap = 6;
  const maxPerRow = Math.min(items.length, 4);
  const rowW = canvasW - leftPad - rightPad;
  const chipW = Math.min(132, (rowW - gap * (maxPerRow - 1)) / maxPerRow);
  const chipH = HAND_MENU_EXPANDED_HEIGHT - 8;

  items.forEach((item, i) => {
    const col = i % maxPerRow;
    const row = Math.floor(i / maxPerRow);
    picks.push({
      id: item.id,
      label: item.label,
      x: leftPad + col * (chipW + gap),
      y: top + row * (chipH + gap),
      w: chipW,
      h: chipH,
    });
  });
}

export function isInHandMenuBand(y: number): boolean {
  return y >= HAND_MENU_TOP && y <= HAND_MENU_TOP + HAND_MENU_HEIGHT + 8;
}

export function isInHandMenuArea(y: number, expand: HandMenuExpand): boolean {
  if (isInHandMenuBand(y)) return true;
  if (!expand) return false;
  return y <= HAND_MENU_TOP + HAND_MENU_HEIGHT + HAND_MENU_EXPANDED_HEIGHT + 24;
}

export function pickHandMenuZone(x: number, y: number, layout: HandMenuLayout): HandMenuZone | null {
  if (!isInHandMenuBand(y)) return null;
  return layout.zones.find((z) => !z.disabled && pointInRect(x, y, z)) ?? null;
}

export function pickHandMenuItem(x: number, y: number, layout: HandMenuLayout): HandMenuPick | null {
  if (!layout.expand) return null;
  return layout.picks.find((p) => pointInRect(x, y, p)) ?? null;
}

function pointInRect(x: number, y: number, r: { x: number; y: number; w: number; h: number }) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

export function drawHandMenu(
  ctx: CanvasRenderingContext2D,
  layout: HandMenuLayout,
  hoverZoneId: string | null,
  hoverPickId: string | null,
  dwellProgress: number
) {
  ctx.save();

  for (const zone of layout.zones) {
    const hover = hoverZoneId === zone.id;
    const alpha = zone.disabled ? 0.35 : hover ? 0.92 : 0.72;
    ctx.fillStyle = `rgba(14,17,22,${alpha})`;
    ctx.strokeStyle = hover
      ? "rgba(139,124,246,0.95)"
      : zone.disabled
        ? "rgba(245,243,238,0.08)"
        : "rgba(245,243,238,0.18)";
    ctx.lineWidth = hover ? 2 : 1;
    roundRect(ctx, zone.x, zone.y, zone.w, zone.h, 8);
    ctx.fill();
    ctx.stroke();

    if (hover && dwellProgress > 0 && !layout.expand) {
      ctx.fillStyle = "rgba(139,124,246,0.35)";
      roundRect(ctx, zone.x, zone.y, zone.w * Math.min(1, dwellProgress), zone.h, 8);
      ctx.fill();
    }

    ctx.fillStyle = zone.disabled ? "rgba(138,143,152,0.8)" : "rgba(138,143,152,1)";
    ctx.font = "600 10px system-ui,sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(zone.title, zone.x + 8, zone.y + 16);

    ctx.fillStyle = zone.disabled ? "rgba(180,185,194,0.85)" : "#f5f3ee";
    ctx.font = "600 11px var(--font-jetbrains-mono, monospace)";
    ctx.fillText(truncate(zone.value, 14), zone.x + 8, zone.y + 38);
  }

  if (layout.expand && layout.picks.length > 0) {
    const minX = Math.min(...layout.picks.map((p) => p.x));
    const maxX = Math.max(...layout.picks.map((p) => p.x + p.w));
    const minY = Math.min(...layout.picks.map((p) => p.y));
    const maxY = Math.max(...layout.picks.map((p) => p.y + p.h));
    ctx.fillStyle = "rgba(8,10,13,0.88)";
    roundRect(ctx, minX - 6, minY - 6, maxX - minX + 12, maxY - minY + 12, 10);
    ctx.fill();
    ctx.strokeStyle = "rgba(139,124,246,0.45)";
    ctx.stroke();

    for (const pick of layout.picks) {
      const hover = hoverPickId === pick.id;
      ctx.fillStyle = hover ? "rgba(139,124,246,0.32)" : "rgba(24,28,34,0.95)";
      ctx.strokeStyle = hover ? "rgba(242,179,61,0.9)" : "rgba(245,243,238,0.14)";
      ctx.lineWidth = hover ? 2 : 1;
      roundRect(ctx, pick.x, pick.y, pick.w, pick.h, 7);
      ctx.fill();
      ctx.stroke();

      if (hover && dwellProgress > 0) {
        ctx.fillStyle = "rgba(242,179,61,0.28)";
        roundRect(ctx, pick.x, pick.y, pick.w * Math.min(1, dwellProgress), pick.h, 7);
        ctx.fill();
      }

      ctx.fillStyle = hover ? "#f2b33d" : "#f5f3ee";
      ctx.font = "600 11px system-ui,sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(truncate(pick.label, 16), pick.x + pick.w / 2, pick.y + pick.h / 2);
    }

    ctx.font = "500 10px system-ui,sans-serif";
    ctx.fillStyle = "rgba(138,143,152,0.95)";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("손가락을 0.5초 올려 선택 · 아래 휠로 닫기", minX, maxY + 18);
  }

  ctx.restore();
}

export interface SessionHudData {
  mode: GameMode;
  score: number;
  combo: number;
  hits: number;
  misses: number;
}

export function drawSessionHud(ctx: CanvasRenderingContext2D, canvasW: number, hud: SessionHudData) {
  const w = 118;
  const h = hud.mode === "freestyle" ? 48 : 58;
  const x = canvasW - w - 12;
  const y = HAND_MENU_TOP + 4;

  ctx.save();
  ctx.fillStyle = "rgba(10,12,15,0.82)";
  ctx.strokeStyle = "rgba(245,243,238,0.12)";
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();

  if (hud.mode === "freestyle") {
    ctx.fillStyle = "#c9bfff";
    ctx.font = "700 13px system-ui,sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("FREE", x + w - 10, y + 22);
    ctx.fillStyle = "rgba(138,143,152,1)";
    ctx.font = "500 10px system-ui,sans-serif";
    ctx.fillText("자유 연주", x + w - 10, y + 38);
  } else {
    ctx.fillStyle = "#f2b33d";
    ctx.font = "700 18px var(--font-jetbrains-mono, monospace)";
    ctx.textAlign = "right";
    ctx.fillText(String(hud.score), x + w - 10, y + 24);
    ctx.fillStyle = "#8b7cf6";
    ctx.font = "600 10px var(--font-jetbrains-mono, monospace)";
    ctx.fillText(`C${hud.combo}`, x + w - 10, y + 40);
    ctx.fillStyle = "rgba(138,143,152,1)";
    ctx.font = "500 10px var(--font-jetbrains-mono, monospace)";
    ctx.fillText(`H${hud.hits} M${hud.misses}`, x + w - 10, y + 52);
  }

  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export class HandMenuDwell {
  private targetKey: string | null = null;
  private since = 0;

  progress(now: number, key: string | null, dwellMs: number): number {
    if (!key) {
      this.targetKey = null;
      this.since = 0;
      return 0;
    }
    if (key !== this.targetKey) {
      this.targetKey = key;
      this.since = now;
    }
    return Math.min(1, (now - this.since) / dwellMs);
  }

  isComplete(now: number, key: string | null, dwellMs: number): boolean {
    return key !== null && this.progress(now, key, dwellMs) >= 1;
  }
}
