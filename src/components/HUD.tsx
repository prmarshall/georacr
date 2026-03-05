import type { VehicleHandle } from "@/components/Vehicle/Vehicle";
import { Speedometer } from "@/components/Speedometer";
import { Stopwatch } from "@/components/Stopwatch";

export function HUD({
  vehicleRef,
  resetKey,
}: {
  vehicleRef: React.RefObject<VehicleHandle | null>;
  resetKey: number;
}) {
  return (
    <>
      <Speedometer vehicleRef={vehicleRef} />
      <Stopwatch vehicleRef={vehicleRef} resetKey={resetKey} />
    </>
  );
}
