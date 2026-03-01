import {
  loadVehicleEntry,
  parseVehicleJSON,
  type VehicleEntry,
} from "./vehicleConfig";

const vehicleModules = import.meta.glob("/src/vehicles/*.json", {
  eager: true,
  import: "default",
});

export const VEHICLES: VehicleEntry[] = Object.values(vehicleModules).map(
  (raw) => loadVehicleEntry(parseVehicleJSON(raw)),
);
