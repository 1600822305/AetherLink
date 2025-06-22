import React from 'react';
import { FormControlLabel, Tooltip, Box } from '@mui/material';
import { Wrench as BuildIcon } from 'lucide-react';
import { useTheme } from '@mui/material/styles';
import CustomSwitch from './CustomSwitch';

interface ToolsSwitchProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  label?: string;
}

/**
 * 工具开关组件
 * 用于控制是否在API请求中包含工具调用功能
 */
const ToolsSwitch: React.FC<ToolsSwitchProps> = ({
  enabled,
  onChange,
  label = '工具'
}) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  return (
    <Tooltip title="控制是否在API请求中包含工具调用功能">
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
        borderRadius: '16px',
        padding: '2px 8px',
        margin: '0 4px'
      }}>
        <BuildIcon
          size={18}
          color={enabled ? (isDarkMode ? '#90caf9' : '#1976d2') : (isDarkMode ? '#aaa' : '#777')}
          style={{ marginRight: '4px' }}
        />
        <FormControlLabel
          control={
            <CustomSwitch
              checked={enabled}
              onChange={(e) => onChange(e.target.checked)}
            />
          }
          label={label}
          sx={{
            margin: 0,
            '& .MuiFormControlLabel-label': {
              fontSize: '14px',
              color: enabled ? (isDarkMode ? '#90caf9' : '#1976d2') : (isDarkMode ? '#aaa' : '#777'),
            }
          }}
        />
      </Box>
    </Tooltip>
  );
};

export default ToolsSwitch;
