# HandChord Trainer (Next.js)

웹캠으로 손가락을 인식해 코드 진행을 연습하는 트레이너입니다.

## 시작하기

```bash
npm install
npm run dev
```

브라우저에서 http://localhost:3000 을 열고 카메라 권한을 허용하세요.

## 배포

```bash
npm run build
npm run start
```

Vercel에 배포하면 별도 설정 없이 바로 동작합니다 (HTTPS가 필요한 카메라 권한도 자동으로 충족됩니다).
로컬에서 `next dev`로 켤 때도 `localhost`는 브라우저가 보안 예외로 허용하므로 카메라가 정상 동작합니다.

## 구조

```
src/
  app/            App Router 엔트리 (layout, page, globals.css)
  components/     ChordTrainer(오케스트레이터), ControlsPanel, Timeline, StatsBar
  hooks/          useAudioEngine (Tone.js), useHandTracking (MediaPipe HandLandmarker)
  lib/            chords.ts(코드 파서), songs.ts(프리셋/커스텀 진행), wheelMath.ts, gameTypes.ts
```

## 기술 스택

- Next.js 16 (App Router, TypeScript)
- MediaPipe Tasks Vision — `HandLandmarker` (구형 `@mediapipe/hands`는 번들러와 호환되지 않아 최신 API로 교체)
- Tone.js — 화음 합성 및 박자 스케줄링(Transport)

## 모드

- **연습모드**: 시간 제한 없이 정확한 코드를 짚어야 다음 코드로 진행
- **박자모드**: BPM에 맞춰 자동으로 다음 코드가 나오고, 제때 못 맞추면 미스 처리
