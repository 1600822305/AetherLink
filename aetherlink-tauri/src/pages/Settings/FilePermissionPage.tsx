import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton
} from '@mui/material';
import {
  ArrowLeft as ArrowBackIcon
} from 'lucide-react';
import { FilePermissionManager } from '../../components/FilePermissionManager';

const FilePermissionPage: React.FC = () => {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate('/settings/workspace');
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 顶部导航栏 */}
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <IconButton edge="start" onClick={handleBack} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            文件访问权限
          </Typography>
        </Toolbar>
      </AppBar>

      {/* 主要内容 */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        <FilePermissionManager />
      </Box>
    </Box>
  );
};

export default FilePermissionPage;
