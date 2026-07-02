"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
} from "@mediapipe/tasks-vision";

export type HandResultsListener = (
  result: HandLandmarkerResult,
  videoEl: HTMLVideoElement
) => void;

export interface HandTracking {
  start: (videoEl: HTMLVideoElement) => Promise<void>;
  stop: () => void;
}

// Pinned to the installed package version so the WASM runtime always
// matches the JS API shipped in node_modules.
const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

/**
 * Sets up MediaPipe's HandLandmarker (the modern, bundler-friendly Tasks
 * Vision API — the classic `@mediapipe/hands` package only exposes a
 * global `window.Hands`, which webpack/turbopack can't statically import)
 * plus a manual getUserMedia + requestAnimationFrame video loop.
 *
 * The onResults callback is kept in a ref so callers can pass a fresh
 * closure every render without tearing down the camera/model each time.
 */
export function useHandTracking(onResults: HandResultsListener): HandTracking {
  const onResultsRef = useRef(onResults);
  useEffect(() => {
    onResultsRef.current = onResults;
  }, [onResults]);

  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const runningRef = useRef(false);

  const start = useCallback(async (videoEl: HTMLVideoElement) => {
    if (runningRef.current) return;

    const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
    const handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
      runningMode: "VIDEO",
      numHands: 2,
      minHandDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });
    landmarkerRef.current = handLandmarker;

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720, facingMode: "user" },
      audio: false,
    });
    streamRef.current = stream;
    videoEl.srcObject = stream;
    await videoEl.play();

    runningRef.current = true;

    let lastVideoTime = -1;
    const loop = () => {
      if (!runningRef.current) return;
      const landmarker = landmarkerRef.current;
      if (landmarker && videoEl.readyState >= 2 && videoEl.currentTime !== lastVideoTime) {
        lastVideoTime = videoEl.currentTime;
        const result = landmarker.detectForVideo(videoEl, performance.now());
        onResultsRef.current(result, videoEl);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  const stop = useCallback(() => {
    runningRef.current = false;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    landmarkerRef.current?.close();
    landmarkerRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { start, stop };
}
