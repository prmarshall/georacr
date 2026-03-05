import { useEffect, useRef } from "react";
import type { VehicleHandle } from "@/components/Vehicle/Vehicle";
import styles from "@/components/HUD.module.scss";

export function Speedometer({
  vehicleRef,
}: {
  vehicleRef: React.RefObject<VehicleHandle | null>;
}) {
  const kmhRef = useRef<HTMLSpanElement>(null);
  const mphRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf: number;
    let smoothedKmh = 0;
    const update = () => {
      if (kmhRef.current && mphRef.current && vehicleRef.current) {
        const rawKmh = vehicleRef.current.speed * 3.6;
        smoothedKmh += (rawKmh - smoothedKmh) * 0.15;
        kmhRef.current.textContent = `${Math.round(smoothedKmh)}`;
        mphRef.current.textContent = `${Math.round(smoothedKmh * 0.621371)}`;
      }
      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [vehicleRef]);

  return (
    <div className={styles.speedometer}>
      <span ref={mphRef} className={styles.speedValue}>
        0
      </span>
      <span className={styles.speedUnit}>mph</span>
      <span ref={kmhRef} className={styles.speedValueSecondary}>
        0
      </span>
      <span className={styles.speedUnitSecondary}>km/h</span>
    </div>
  );
}
