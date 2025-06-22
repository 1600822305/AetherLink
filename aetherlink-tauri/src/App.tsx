
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { SnackbarProvider } from 'notistack';
import { HashRouter } from 'react-router-dom';

import store, { persistor } from './shared/store';
import KnowledgeProvider from './components/KnowledgeManagement/KnowledgeProvider';
import AppContent from './components/AppContent';
import LoadingScreen from './components/LoadingScreen';
import LoggerService from './shared/services/LoggerService';

// 初始化日志拦截器
LoggerService.log('INFO', '应用初始化');

function App() {
  return (
    <Provider store={store}>
      <PersistGate loading={<LoadingScreen progress={0} step="正在加载..." isFirstInstall={false} />} persistor={persistor}>
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
