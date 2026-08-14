import { create } from 'zustand';

interface AulaStore {
  pendingCount: number;
  setPendingCount: (count: number) => void;
}

export const useAulaStore = create<AulaStore>((set) => ({
  pendingCount: 0,
  setPendingCount: (pendingCount) => set({ pendingCount }),
}));
