"use client";

import { useEffect, useState } from "react";

export interface ViewportSize {
  w: number;
  h: number;
}

export function useViewportSize(): ViewportSize {
  const [size, setSize] = useState<ViewportSize>({ w: 0, h: 0 });

  useEffect(() => {
    function update() {
      setSize({ w: window.innerWidth, h: window.innerHeight });
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return size;
}
