/**
 * 思考过程设置组件
 * 用于配置思考过程的显示和行为
 */
import React from 'react';
import {
  Box,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormLabel,
  Radio,
  RadioGroup,
  Switch,
  Typography
} from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../../shared/store';
import {
  setShowThinking,
  setThinkingDisplayStyle,
  setThoughtAutoCollapse,
  setDefaultThinkingEffort
} from '../../shared/store/slices/uiSlice';
import type { ThinkingOption } from '../../shared/config/reasoningConfig';

/**
 * 思考过程设置组件
 */
const ThinkingSettings: React.FC = () => {
  const dispatch = useDispatch();
  const {
    showThinking,
    thinkingDisplayStyle,
    thoughtAutoCollapse,
    defaultThinkingEffort
  } = useSelector((state: RootState) => state.ui);

  // 处理显示样式变更
  const handleDisplayStyleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setThinkingDisplayStyle(event.target.value as 'compact' | 'detailed' | 'hidden'));
  };

  // 处理自动折叠变更
  const handleAutoCollapseChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setThoughtAutoCollapse(event.target.checked));
  };

  // 处理显示思考过程变更
  const handleShowThinkingChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setShowThinking(event.target.checked));
  };

  // 处理默认思考深度变更
  const handleDefaultEffortChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setDefaultThinkingEffort(event.target.value as ThinkingOption));
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        思考过程设置
      </Typography>

      {/* 显示思考过程开关 */}
      <FormGroup>
        <FormControlLabel
          control={
            <Switch
              checked={showThinking}
              onChange={handleShowThinkingChange}
            />
          }
          label="显示思考过程"
        />
      </FormGroup>

      {/* 思考过程自动折叠开关 */}
      <FormGroup>
        <FormControlLabel
          control={
            <Switch
              checked={thoughtAutoCollapse}
              onChange={handleAutoCollapseChange}
              disabled={!showThinking}
            />
          }
          label="自动折叠思考过程"
        />
      </FormGroup>

      {/* 思考过程显示样式 */}
      <FormControl component="fieldset" sx={{ mt: 2 }} disabled={!showThinking}>
        <FormLabel component="legend">思考过程显示样式</FormLabel>
        <RadioGroup
          value={thinkingDisplayStyle}
          onChange={handleDisplayStyleChange}
        >
          <FormControlLabel value="compact" control={<Radio />} label="紧凑模式" />
          <FormControlLabel value="detailed" control={<Radio />} label="详细模式" />
          <FormControlLabel value="hidden" control={<Radio />} label="隐藏模式" />
        </RadioGroup>
      </FormControl>

      {/* 默认思考深度 */}
      <FormControl component="fieldset" sx={{ mt: 2 }}>
        <FormLabel component="legend">默认思考深度</FormLabel>
        <RadioGroup
          value={defaultThinkingEffort}
          onChange={handleDefaultEffortChange}
        >
          <FormControlLabel value="off" control={<Radio />} label="关闭思考" />
          <FormControlLabel value="low" control={<Radio />} label="低强度思考" />
          <FormControlLabel value="medium" control={<Radio />} label="中强度思考" />
          <FormControlLabel value="high" control={<Radio />} label="高强度思考" />
          <FormControlLabel value="auto" control={<Radio />} label="自动思考" />
        </RadioGroup>
      </FormControl>
    </Box>
  );
};

export default ThinkingSettings;
