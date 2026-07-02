"use client";

import { useState } from "react";
import styles from "./TutorialOverlay.module.css";

export interface TutorialOverlayProps {
  onComplete: () => void;
  onSkip: () => void;
  starting: boolean;
  statusLine: string;
}

const STEPS = [
  {
    title: "HandChord에 오신 걸 환영해요",
    body: "웹캠으로 손가락만으로 코드를 짚고, 진행 연습까지 할 수 있어요. 영상은 브라우저 밖으로 나가지 않아요.",
    visual: "welcome" as const,
  },
  {
    title: "양손을 펴고, 휠 위에 올려요",
    body: "왼손은 화면 왼쪽 원(루트 C~B), 오른손은 오른쪽 원(maj · m · 7 · maj7 …) 위에 두세요. 카메라에서 팔 길이 정도(50~80cm) 떨어지면 인식이 안정적이에요.",
    visual: "hands" as const,
  },
  {
    title: "검지 끝이 커서예요",
    body: "손바닥 전체가 아니라 검지 끝(흰 링이 있는 점)으로 세그먼트를 가리켜요. 손을 쫙 편 상태에서 검지만 휠 위로 이동하면 됩니다.",
    visual: "index" as const,
  },
  {
    title: "가운데 OFF = 쉬는 구역",
    body: "휠 중앙의 작은 원 안으로 손가락을 넣으면 소리가 꺼져요. 코드를 바꿀 때 잠깐 쉬거나, 연주 없이 손을 놔둘 때 사용하세요.",
    visual: "offzone" as const,
  },
  {
    title: "루트 + 품질 = 코드",
    body: "예: 왼손 C + 오른손 m → Cm. 연습·박자 모드는 NOW 코드를 맞추고, 자유 모드는 곡 없이 마음대로 연주해요.",
    visual: "chord" as const,
  },
  {
    title: "준비됐어요",
    body: "카메라를 켜면 바로 연주할 수 있어요. 악기·옥타브·모드·곡은 연주 중 화면 상단 손 메뉴에서 고르세요.",
    visual: "instrument" as const,
  },
];

function StepVisual({ kind }: { kind: (typeof STEPS)[number]["visual"] }) {
  if (kind === "welcome") {
    return (
      <div className={styles.visualWelcome}>
        <span className={styles.wheelMini} aria-hidden />
        <span className={styles.wheelMini} aria-hidden />
      </div>
    );
  }

  if (kind === "hands") {
    return (
      <div className={styles.visualHands} aria-hidden>
        <div className={styles.wheelGuideLeft}>
          <span className={styles.wheelRing} />
          <span className={styles.handLeft}>🤚</span>
          <span className={styles.wheelLabel}>루트</span>
        </div>
        <div className={styles.wheelGuideRight}>
          <span className={styles.wheelRing} />
          <span className={styles.handRight}>✋</span>
          <span className={styles.wheelLabel}>품질</span>
        </div>
      </div>
    );
  }

  if (kind === "index") {
    return (
      <div className={styles.visualIndex} aria-hidden>
        <span className={styles.handEmoji}>🖐️</span>
        <span className={styles.indexDot} />
        <span className={styles.indexHint}>검지 끝</span>
      </div>
    );
  }

  if (kind === "offzone") {
    return (
      <div className={styles.visualOffzone} aria-hidden>
        <span className={styles.wheelRingLarge}>
          <span className={styles.offCore}>OFF</span>
        </span>
      </div>
    );
  }

  if (kind === "chord") {
    return (
      <div className={styles.visualChord} aria-hidden>
        <span className={styles.chordPart}>C</span>
        <span className={styles.chordPlus}>+</span>
        <span className={styles.chordPart}>m</span>
        <span className={styles.chordEquals}>=</span>
        <span className={styles.chordResult}>Cm</span>
      </div>
    );
  }

  return (
    <div className={styles.visualInstrument} aria-hidden>
      <span className={styles.waveBar} />
      <span className={styles.waveBar} />
      <span className={styles.waveBar} />
      <span className={styles.waveBar} />
      <span className={styles.waveBar} />
    </div>
  );
}

export function TutorialOverlay({ onComplete, onSkip, starting, statusLine }: TutorialOverlayProps) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <div className={styles.progress}>
          {STEPS.map((_, i) => (
            <span key={i} className={i === step ? styles.dotActive : styles.dot} />
          ))}
        </div>

        <p className={`${styles.stepLabel} font-mono`}>
          {step + 1} / {STEPS.length}
        </p>
        <h2 className={`${styles.title} font-display`}>{current.title}</h2>
        <p className={styles.body}>{current.body}</p>

        <StepVisual kind={current.visual} />

        <div className={styles.actions}>
          {step > 0 && (
            <button type="button" className={styles.secondaryBtn} onClick={() => setStep(step - 1)}>
              이전
            </button>
          )}
          {!isLast ? (
            <button type="button" className={styles.primaryBtn} onClick={() => setStep(step + 1)}>
              다음
            </button>
          ) : (
            <button
              type="button"
              className={`${styles.primaryBtn} font-display`}
              onClick={onComplete}
              disabled={starting}
            >
              {starting ? "준비 중…" : "카메라 시작"}
            </button>
          )}
          <button type="button" className={styles.skipBtn} onClick={onSkip}>
            건너뛰기
          </button>
        </div>

        {statusLine ? <div className={`${styles.statusLine} font-mono`}>{statusLine}</div> : null}
      </div>
    </div>
  );
}
