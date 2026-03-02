import { useEffect, useRef, useState } from "react";
import type { VehicleHandle } from "@/components/Vehicle/Vehicle";
import styles from "@/components/HUD.module.scss";

export function ZeroToSixty({
  vehicleRef,
  startTime,
  resetKey,
}: {
  vehicleRef: React.RefObject<VehicleHandle | null>;
  startTime: React.RefObject<number | null>;
  resetKey: number;
}) {
  const [time, setTime] = useState<number | null>(null);
  const captured = useRef(false);

  useEffect(() => {
    captured.current = false;
    setTime(null);
  }, [resetKey]);

  useEffect(() => {
    let raf: number;
    const update = () => {
      if (
        !captured.current &&
        startTime.current !== null &&
        vehicleRef.current
      ) {
        const mph = vehicleRef.current.speed * 3.6 * 0.621371;
        if (mph >= 60) {
          captured.current = true;
          setTime((performance.now() - startTime.current) / 1000);
        }
      }
      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [vehicleRef, startTime, resetKey]);

  if (time === null) return null;

  return (
    <span className={styles.zeroToSixty}>
      <span className={styles.zeroToSixtyLabel}>0–60</span>
      {time.toFixed(2)}
      <span className={styles.unit}> s</span>
    </span>
  );
}
