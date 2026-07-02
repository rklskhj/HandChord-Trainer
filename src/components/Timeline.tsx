"use client";

import type { Song } from "@/lib/songs";
import type { HitMark } from "@/lib/gameTypes";
import styles from "./Timeline.module.css";

interface TimelineProps {
  song: Song | null;
  currentIndex: number;
  historyMark: HitMark[];
}

export function Timeline({ song, currentIndex, historyMark }: TimelineProps) {
  if (!song) return null;
  return (
    <div className={styles.track}>
      {song.chords.map((c, i) => {
        const mark = historyMark[i];
        const classNames = [
          styles.chip,
          "font-display",
          i === currentIndex ? styles.current : "",
          mark === "hit" ? styles.hit : "",
          mark === "miss" ? styles.miss : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <div key={`${c.name}-${i}`} className={classNames}>
            <span className={`${styles.idx} font-mono`}>{i + 1}</span>
            {c.name}
          </div>
        );
      })}
    </div>
  );
}
