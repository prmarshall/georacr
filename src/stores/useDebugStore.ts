import { create } from "zustand";

interface DebugState {
  showCloseCamHelper: boolean;
  showTileWireframe: boolean;
  showBboxHelper: boolean;

  toggleCloseCamHelper: () => void;
  toggleTileWireframe: () => void;
  toggleBboxHelper: () => void;
}

export const useDebugStore = create<DebugState>((set) => ({
  showCloseCamHelper: false,
  showTileWireframe: false,
  showBboxHelper: false,

  toggleCloseCamHelper: () =>
    set((s) => ({ showCloseCamHelper: !s.showCloseCamHelper })),
  toggleTileWireframe: () =>
    set((s) => ({ showTileWireframe: !s.showTileWireframe })),
  toggleBboxHelper: () => set((s) => ({ showBboxHelper: !s.showBboxHelper })),
}));
