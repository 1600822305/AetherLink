import React from 'react';
import { Box, Typography, Avatar, Divider } from '@mui/material';
import { Cloud } from 'lucide-react';

/**
 * 备份头部组件
 */
const BackupHeader: React.FC = () => {
  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Avatar
          sx={{
            width: 56,
            height: 56,
            bgcolor: '#9333EA',
            fontSize: '1.5rem',
            mr: 2,
            boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
          }}
        >
          <Cloud size={24} />
        </Avatar>
        <Box>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 600,
              backgroundImage: 'linear-gradient(90deg, #9333EA, #754AB4)',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            数据备份与恢复
          </Typography>
          <Typography variant="body2" color="text.secondary">
            备份您的对话和助手数据，以便在更换设备或重新安装应用后恢复
          </Typography>
        </Box>
      </Box>
      
      <Divider sx={{ my: 2 }} />
    </>
  );
};

export default BackupHeader; 