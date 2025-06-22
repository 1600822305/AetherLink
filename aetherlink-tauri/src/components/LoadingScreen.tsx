import React from 'react';
import { useTheme } from '../hooks/useTheme';

interface LoadingScreenProps {
  progress: number;
  step: string;
  isFirstInstall: boolean;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ 
  progress, 
  step, 
  isFirstInstall 
}) => {
  const { mode } = useTheme();

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      background: mode === 'light' ? '#F8FAFC' : '#1a1a1a',
      padding: '20px'
    }}>
      <div style={{
        textAlign: 'center',
        maxWidth: '400px'
      }}>
        {/* 应用图标或Logo */}
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '20px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 30px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
        }}>
          <span style={{
            color: 'white',
            fontSize: '32px',
            fontWeight: 'bold'
          }}>A</span>
        </div>

        {/* 应用名称 */}
        <h1 style={{
          color: mode === 'light' ? '#1a1a1a' : '#ffffff',
          fontSize: '28px',
          fontWeight: 'bold',
          margin: '0 0 10px 0'
        }}>AetherLink</h1>

        {/* 首次安装欢迎信息 */}
        {isFirstInstall && (
          <div style={{
            color: mode === 'light' ? '#667eea' : '#a78bfa',
            fontSize: '14px',
            marginBottom: '10px',
            fontWeight: '500'
          }}>欢迎使用智能对话助手</div>
        )}

        {/* 初始化步骤 */}
        <div style={{
          color: mode === 'light' ? '#64748B' : '#a0a0a0',
          fontSize: '16px',
          marginBottom: '30px'
        }}>{step}</div>

        {/* 进度条 */}
        <div style={{
          width: '100%',
          height: '4px',
          backgroundColor: mode === 'light' ? '#e2e8f0' : '#374151',
          borderRadius: '2px',
          overflow: 'hidden',
          marginBottom: '20px'
        }}>
          <div style={{
            width: `${progress}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '2px',
            transition: 'width 0.3s ease'
          }} />
        </div>

        {/* 进度百分比 */}
        <div style={{
          color: mode === 'light' ? '#64748B' : '#a0a0a0',
          fontSize: '14px'
        }}>{progress}%</div>
      </div>
    </div>
  );
};

export default LoadingScreen;
