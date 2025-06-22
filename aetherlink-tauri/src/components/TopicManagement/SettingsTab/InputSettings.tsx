import React, { useState } from 'react';
import {
  Box,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  TextField,

  Typography,
  IconButton,
  Divider,
  FormControlLabel
} from '@mui/material';
import CustomSwitch from '../../CustomSwitch'; // 导入 CustomSwitch 组件
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '../../../shared/store';
import { setPasteLongTextAsFile, setPasteLongTextThreshold } from '../../../shared/store/settingsSlice';
import OptimizedCollapse from './OptimizedCollapse';

/**
 * 输入设置组件
 * 包含长文本粘贴为文件等输入相关的设置
 */
export default function InputSettings() {
  const dispatch = useAppDispatch();
  const settings = useAppSelector((state) => state.settings);

  // 从Redux状态获取设置值，如果未定义则使用默认值
  const pasteLongTextAsFile = settings.pasteLongTextAsFile ?? false;
  const pasteLongTextThreshold = settings.pasteLongTextThreshold ?? 1500;

  const [expanded, setExpanded] = useState(false);

  // 处理长文本粘贴开关变化
  const handlePasteLongTextAsFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setPasteLongTextAsFile(event.target.checked));
  };

  // 处理阈值变化
  const handleThresholdChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value, 10);
    if (!isNaN(value) && value >= 100 && value <= 10000) {
      dispatch(setPasteLongTextThreshold(value));
    }
  };

  // 处理阈值输入框失焦时的验证
  const handleThresholdBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value, 10);
    if (isNaN(value) || value < 100) {
      dispatch(setPasteLongTextThreshold(100));
    } else if (value > 10000) {
      dispatch(setPasteLongTextThreshold(10000));
    }
  };

  return (
    <>
      {/* 输入设置标题行 */}
      <ListItem
        component="div"
        onClick={() => setExpanded(!expanded)}
        sx={{
          px: 2,
          py: 0.5,
          cursor: 'pointer',
          position: 'relative',
          zIndex: 1,
          touchAction: 'manipulation',
          userSelect: 'none',
          '@media (hover: none)': {
            '&:active': {
              backgroundColor: 'rgba(0, 0, 0, 0.04)',
              transform: 'scale(0.98)',
              transition: 'all 0.1s ease-out'
            }
          },
          '@media (hover: hover)': {
            '&:hover': {
              backgroundColor: 'rgba(0, 0, 0, 0.02)',
              transform: 'none !important',
              boxShadow: 'none !important'
            },
            '&:focus': {
              backgroundColor: 'transparent !important'
            },
            '&:active': {
              backgroundColor: 'rgba(0, 0, 0, 0.04)'
            }
          },
          '& *': {
            pointerEvents: 'none',
            '&:hover': {
              backgroundColor: 'transparent !important',
              transform: 'none !important'
            }
          }
        }}
      >
        <ListItemText
          primary="输入设置"
          secondary="粘贴和输入相关的功能设置"
          primaryTypographyProps={{ fontWeight: 'medium', fontSize: '0.95rem', lineHeight: 1.2 }}
          secondaryTypographyProps={{ fontSize: '0.75rem', lineHeight: 1.2 }}
        />
        <ListItemSecondaryAction>
          <IconButton edge="end" size="small" sx={{ padding: '2px' }}>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </IconButton>
        </ListItemSecondaryAction>
      </ListItem>

      {/* 可折叠的内容区域 */}
      <OptimizedCollapse
        in={expanded}
        timeout={150}
        unmountOnExit
      >
        <Box sx={{ px: 2, pb: 2 }}>
          {/* 长文本粘贴为文件设置 */}
          <Box sx={{ mb: 2 }}>
            <FormControlLabel
              control={
                <CustomSwitch
                  checked={pasteLongTextAsFile}
                  onChange={handlePasteLongTextAsFileChange}
                />
              }
              label={
                <Box>
                  <Typography variant="body2" fontWeight="medium">
                    长文本粘贴为文件
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    当粘贴的文本超过设定长度时，自动转换为文件
                  </Typography>
                </Box>
              }
              sx={{
                width: '100%',
                margin: 0,
                display: 'flex',
                justifyContent: 'space-between',
                '& .MuiFormControlLabel-label': {
                  flex: 1,
                  marginRight: 1
                }
              }}
              labelPlacement="start"
            />
          </Box>

          {/* 阈值设置 - 只有在启用长文本粘贴时才显示 */}
          {pasteLongTextAsFile && (
            <>
              <Divider sx={{ my: 1 }} />
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Box>
                    <Typography variant="body2" fontWeight="medium">
                      长文本阈值: {pasteLongTextThreshold} 字符
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      超过此字符数的文本将转换为文件
                    </Typography>
                  </Box>
                  <Box sx={{ width: '80px' }}>
                    <TextField
                      size="small"
                      type="number"
                      value={pasteLongTextThreshold}
                      onChange={handleThresholdChange}
                      onBlur={handleThresholdBlur}
                      inputProps={{
                        min: 100,
                        max: 10000,
                        step: 100
                      }}
                      sx={{
                        '& .MuiInputBase-input': {
                          fontSize: '0.875rem',
                          textAlign: 'center'
                        }
                      }}
                    />
                  </Box>
                </Box>

                {/* 阈值说明 */}
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  建议范围：100-10000 字符。较小的值会让更多文本转为文件，较大的值则相反。
                </Typography>
              </Box>
            </>
          )}
        </Box>
      </OptimizedCollapse>
    </>
  );
}
