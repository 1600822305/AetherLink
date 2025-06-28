import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { SnackbarProvider } from 'notistack';
import { HashRouter } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';
import i18n from 'i18next';
import { useAppSelector } from './shared/store';
import React from 'react';

import store, { persistor } from './shared/store';
import KnowledgeProvider from './components/KnowledgeManagement/KnowledgeProvider';
import AppContent from './components/AppContent';
import LoadingScreen from './components/LoadingScreen';
import LoggerService from './shared/services/LoggerService';

// 初始化日志拦截器
LoggerService.log('INFO', '应用初始化');

// 在 Provider 内部同步语言的辅助组件
const LanguageSync: React.FC = () => {
  const language = useAppSelector((state) => state.settings.language);
  useEffect(() => {
    i18n.changeLanguage(language);
  }, [language]);
  return null;
};

function App() {
  const { t } = useTranslation();

  return (
    <Provider store={store}>
      <LanguageSync />
      <PersistGate loading={<LoadingScreen progress={0} step={t('app.loading')} isFirstInstall={false} />} persistor={persistor}>
        <KnowledgeProvider>
          <SnackbarProvider
            maxSnack={3}
            autoHideDuration={3000}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          >
            <HashRouter>
              <AppContent />
            </HashRouter>
          </SnackbarProvider>
        </KnowledgeProvider>
      </PersistGate>
    </Provider>
  );
}

export default App;
