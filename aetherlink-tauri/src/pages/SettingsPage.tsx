import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const SettingsPageRedirect: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // 重定向到新的设置页面
    navigate('/settings', { replace: true });
  }, [navigate]);

  // 显示加载中
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      加载中...
    </div>
  );
};

export default SettingsPageRedirect;
