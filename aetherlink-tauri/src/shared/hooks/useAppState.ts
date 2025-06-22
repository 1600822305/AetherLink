import { create } from 'zustand';

interface AppState {
  showExitConfirm: boolean;
  setShowExitConfirm: (show: boolean) => void;
  // 对话框状态管理
  openDialogs: Set<string>;
  openDialog: (dialogId: string) => void;
  closeDialog: (dialogId: string) => void;
  hasOpenDialogs: () => boolean;
}

/**
 * 应用状态管理钩子
 * 用于管理全局应用状态，如退出确认对话框的显示状态和对话框管理
 */
export const useAppState = create<AppState>((set, get) => ({
  showExitConfirm: false,
  setShowExitConfirm: (show) => set({ showExitConfirm: show }),

  // 对话框状态管理
  openDialogs: new Set<string>(),
  openDialog: (dialogId: string) => set((state) => ({
    openDialogs: new Set([...state.openDialogs, dialogId])
  })),
  closeDialog: (dialogId: string) => set((state) => {
    const newDialogs = new Set(state.openDialogs);
    newDialogs.delete(dialogId);
    return { openDialogs: newDialogs };
  }),
  hasOpenDialogs: () => get().openDialogs.size > 0,
}));
