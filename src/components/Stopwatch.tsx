import { useEffect, useRef } from "react";
import type { VehicleHandle } from "@/components/Vehicle/Vehicle";
import { ZeroToSixty } from "@/components/ZeroToSixty";
import styles from "@/components/HUD.module.scss";

export function Stopwatch({
  vehicleRef,
  resetKey,
}: {
  vehicleRef: React.RefObject<VehicleHandle | null>;
  resetKey: number;
}) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const startTime = useRef<number | null>(null);

  useEffect(() => {
    startTime.current = null;
    if (spanRef.current) spanRef.current.textContent = "0.00";
  }, [resetKey]);

  useEffect(() => {
    const accelKeys = new Set(["ArrowUp", "KeyW"]);
    const onKeyDown = (e: KeyboardEvent) => {
      if (startTime.current === null && accelKeys.has(e.code)) {
        startTime.current = performance.now();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [resetKey]);

  useEffect(() => {
    let raf: number;
    const update = () => {
      if (spanRef.current && startTime.current !== null) {
        const elapsed = (performance.now() - startTime.current) / 1000;
        spanRef.current.textContent = elapsed.toFixed(2);
      }
      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [resetKey]);

  return (
    <div className={styles.stopwatch}>
      <span ref={spanRef}>0.00</span>
      <span className={styles.unit}> s</span>
      <ZeroToSixty
        vehicleRef={vehicleRef}
        startTime={startTime}
        resetKey={resetKey}
      />
    </div>
  );
}
