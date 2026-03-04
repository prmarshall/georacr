import { create } from "zustand";

interface LoadingState {
  tilesReady: boolean;
  setTilesReady: () => void;
}

export const useLoadingStore = create<LoadingState>((set) => ({
  tilesReady: false,
  setTilesReady: () => set({ tilesReady: true }),
}));
