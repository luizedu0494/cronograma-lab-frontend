import { create } from 'zustand';

interface UserInfo {
  uid?: string;
  email?: string;
  displayName?: string;
  role?: string;
  laboratorios?: string[];
  [key: string]: any;
}

interface AuthStore {
  userInfo: UserInfo | null;
  loading: boolean;
  setUserInfo: (user: UserInfo | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  userInfo: null,
  loading: true,
  setUserInfo: (userInfo) => set({ userInfo, loading: false }),
  setLoading: (loading) => set({ loading }),
}));
