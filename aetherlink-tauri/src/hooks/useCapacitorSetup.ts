import { useEffect } from 'react';
import { App as CapApp } from '@capacitor/app';

export const useCapacitorSetup = () => {
  useEffect(() => {
    let backButtonListener: any = null;

    const setupCapacitor = async () => {
      try {
        backButtonListener = await CapApp.addListener('backButton', () => {
          console.log('[App] 返回键被按下，由BackButtonHandler处理');
        });
      } catch (error) {
        console.error('[App] Capacitor设置失败:', error);
      }
    };

    setupCapacitor();

    return () => {
      if (backButtonListener) {
        backButtonListener.remove();
      }
    };
  }, []);
};
