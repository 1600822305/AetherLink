import React from 'react';
import { styled } from '@mui/material/styles';

const CustomSwitchRoot = styled('span')(({ theme }) => ({
  width: 32, // 调整宽度
  height: 16, // 调整高度，使其更小巧
  padding: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  position: 'relative',
  overflow: 'hidden',
  borderRadius: 8, // 保持圆角
  backgroundColor: theme.palette.mode === 'dark' ? '#8796A5' : '#AAB4BE',
  transition: theme.transitions.create(['background-color'], {
    duration: 200,
  }),
  '&.Mui-checked': {
    backgroundColor: theme.palette.primary.main,
  },
}));

const CustomSwitchThumb = styled('span')(({ theme }) => ({
  width: 12, // 保持圆点宽度
  height: 12, // 保持圆点高度
  borderRadius: '50%',
  backgroundColor: 'white',
  boxShadow: '0 2px 4px 0 rgba(0,0,0,0.2)',
  transition: theme.transitions.create(['transform'], {
    duration: 200,
  }),
  transform: 'translateX(2px)', // 初始位移
  '&.Mui-checked': {
    transform: 'translateX(18px)', // 调整选中时的位移 (32 - 12 - 2*2 = 16, 16+2 = 18)
  },
}));

interface CustomSwitchProps {
  checked: boolean;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  // 可以根据需要添加其他原生input属性，例如 disabled, name, value 等
  disabled?: boolean;
  name?: string;
  value?: string;
}

export default function CustomSwitch(props: CustomSwitchProps) {
  const { checked, onChange, disabled, name, value } = props;

  return (
    <CustomSwitchRoot className={checked ? 'Mui-checked' : ''}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        name={name}
        value={value}
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          opacity: 0,
          cursor: disabled ? 'not-allowed' : 'pointer',
          zIndex: 1,
        }}
      />
      <CustomSwitchThumb className={checked ? 'Mui-checked' : ''} />
    </CustomSwitchRoot>
  );
}