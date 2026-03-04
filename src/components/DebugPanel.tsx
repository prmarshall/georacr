import { useState } from "react";
import { useDebugStore } from "@/stores/useDebugStore";
import { UIButton } from "@/components/UIButton";
import styles from "./DebugPanel.module.scss";

function ToggleRow({
  label,
  active,
  onToggle,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <UIButton
      onClick={onToggle}
      className={`${styles.row} ${active ? styles.active : ""}`}
    >
      <span className={styles.indicator}>{active ? "\u25CF" : "\u25CB"}</span>
      {label}
    </UIButton>
  );
}

export function DebugPanel() {
  const [open, setOpen] = useState(false);

  const showCloseCamHelper = useDebugStore((s) => s.showCloseCamHelper);
  const showTileWireframe = useDebugStore((s) => s.showTileWireframe);
  const showBboxHelper = useDebugStore((s) => s.showBboxHelper);

  const toggleCloseCam = useDebugStore((s) => s.toggleCloseCamHelper);
  const toggleWireframe = useDebugStore((s) => s.toggleTileWireframe);
  const toggleBbox = useDebugStore((s) => s.toggleBboxHelper);

  return (
    <div className={styles.container}>
      <UIButton
        onClick={() => setOpen((o) => !o)}
        className={styles.gearButton}
      >
        &#9881;
      </UIButton>

      {open && (
        <div className={styles.panel}>
          <div className={styles.title}>Debug</div>
          <ToggleRow
            label="LOD Cam Helper"
            active={showCloseCamHelper}
            onToggle={toggleCloseCam}
          />
          <ToggleRow
            label="Tile Wireframe"
            active={showTileWireframe}
            onToggle={toggleWireframe}
          />
          <ToggleRow
            label="Bbox Helper"
            active={showBboxHelper}
            onToggle={toggleBbox}
          />
        </div>
      )}
    </div>
  );
}
