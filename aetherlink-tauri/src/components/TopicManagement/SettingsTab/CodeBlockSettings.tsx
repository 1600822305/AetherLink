import React, { useState } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  FormControl,
  Select,
  MenuItem,
  Typography,
  Collapse,
  IconButton,
  ListSubheader
} from '@mui/material';
import CustomSwitch from '../../CustomSwitch'; // 导入 CustomSwitch 组件
import { ChevronDown, ChevronUp, Edit, Palette } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '../../../shared/store';
import {
  setCodeStyle,
  setCodeEditor,
  setCodeShowLineNumbers,
  setCodeCollapsible,
  setCodeWrappable,
  setCodeDefaultCollapsed,
  setMermaidEnabled
} from '../../../shared/store/settingsSlice';

// 代码风格选项 - 大幅扩展主题选择
const CODE_STYLES = [
  // 自动和经典主题
  { value: 'auto', label: 'Auto', description: '自动跟随系统主题' },
  { value: 'vs-code-light', label: 'VS Code Light', description: 'VS Code 浅色主题' },
  { value: 'vs-code-dark', label: 'VS Code Dark', description: 'VS Code 深色主题' },
  { value: 'github-light', label: 'GitHub Light', description: 'GitHub 风格浅色主题' },
  { value: 'github-dark', label: 'GitHub Dark', description: 'GitHub 风格深色主题' },
  { value: 'one-dark-pro', label: 'One Dark Pro', description: 'Atom 风格深色主题' },
  { value: 'one-light', label: 'One Light', description: 'Atom 风格浅色主题' },
  { value: 'tomorrow', label: 'Tomorrow', description: '清新浅色主题' },
  { value: 'twilight', label: 'Twilight', description: '暮光深色主题' },

  // 流行编辑器主题
  { value: 'atom-dark', label: 'Atom Dark', description: 'Atom 编辑器深色主题' },
  { value: 'darcula', label: 'Darcula', description: 'JetBrains 经典深色主题' },
  { value: 'nord', label: 'Nord', description: '北欧风格深色主题' },
  { value: 'dracula', label: 'Dracula', description: '经典深色主题' },
  { value: 'monokai', label: 'Monokai', description: '经典深色主题' },
  { value: 'lucario', label: 'Lucario', description: '蓝紫色深色主题' },

  // Material 系列
  { value: 'material-dark', label: 'Material Dark', description: 'Material Design 深色主题' },
  { value: 'material-light', label: 'Material Light', description: 'Material Design 浅色主题' },
  { value: 'material-oceanic', label: 'Material Oceanic', description: 'Material 海洋主题' },

  // Duotone 系列
  { value: 'duotone-dark', label: 'Duotone Dark', description: '双色调深色主题' },
  { value: 'duotone-light', label: 'Duotone Light', description: '双色调浅色主题' },
  { value: 'duotone-earth', label: 'Duotone Earth', description: '双色调大地主题' },
  { value: 'duotone-forest', label: 'Duotone Forest', description: '双色调森林主题' },
  { value: 'duotone-sea', label: 'Duotone Sea', description: '双色调海洋主题' },
  { value: 'duotone-space', label: 'Duotone Space', description: '双色调太空主题' },

  // 特色主题
  { value: 'synthwave-84', label: 'Synthwave 84', description: '赛博朋克风格主题' },
  { value: 'shades-of-purple', label: 'Shades of Purple', description: '紫色系主题' },
  { value: 'hopscotch', label: 'Hopscotch', description: '跳房子主题' },
  { value: 'coldark-cold', label: 'Coldark Cold', description: '冷色调浅色主题' },
  { value: 'coldark-dark', label: 'Coldark Dark', description: '冷色调深色主题' },
  { value: 'solarized-light', label: 'Solarized Light', description: 'Solarized 浅色主题' },
  { value: 'base16-light', label: 'Base16 Light', description: 'Base16 浅色主题' },
  { value: 'coy', label: 'Coy', description: '简约浅色主题' },
  { value: 'cb', label: 'CB', description: '经典黑白主题' },
  { value: 'pojoaque', label: 'Pojoaque', description: '温暖色调主题' },
  { value: 'xonokai', label: 'Xonokai', description: 'Monokai 变体主题' },
  { value: 'z-touch', label: 'Z-Touch', description: '触感风格主题' }
];

interface CodeBlockSettingsProps {
  // 暂时保留接口以保持兼容性，但不使用参数
  onSettingChange?: (settingId: string, value: string | boolean) => void;
}

/**
 * 代码块设置组件
 */
const CodeBlockSettings: React.FC<CodeBlockSettingsProps> = () => {
  const dispatch = useAppDispatch();
  const [expanded, setExpanded] = useState(false);

  // 从 Redux store 获取设置
  // 从 Redux store 获取设置
  const {
    codeStyle,
    codeEditor,
    codeShowLineNumbers,
    codeCollapsible,
    codeWrappable,
    codeDefaultCollapsed,
    mermaidEnabled
  } = useAppSelector(state => state.settings);

  const selectedStyle = CODE_STYLES.find(style => style.value === codeStyle);

  return (
    <>
      {/* 代码块设置标题 */}
      <ListItem
        component="div"
        onClick={() => setExpanded(!expanded)}
        sx={{
          px: 2,
          py: 0.5,
          cursor: 'pointer',
          position: 'relative',
          zIndex: 1,
          // 优化触摸响应
          touchAction: 'manipulation',
          userSelect: 'none',
          // 移动端优化
          '@media (hover: none)': {
            '&:active': {
              backgroundColor: 'rgba(0, 0, 0, 0.04)',
              transform: 'scale(0.98)',
              transition: 'all 0.1s ease-out'
            }
          },
          // 桌面端优化
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
            pointerEvents: 'none', // 防止子元素干扰点击
            '&:hover': {
              backgroundColor: 'transparent !important',
              transform: 'none !important'
            }
          }
        }}
      >
        <ListItemText
          primary="代码块设置"
          secondary="配置代码显示和编辑功能"
          primaryTypographyProps={{ fontWeight: 'medium', fontSize: '0.95rem', lineHeight: 1.2 }}
          secondaryTypographyProps={{ fontSize: '0.75rem', lineHeight: 1.2 }}
        />
        <IconButton edge="end" size="small" sx={{ padding: '2px' }}>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </IconButton>
      </ListItem>

      {/* 可折叠的设置内容 */}
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <List sx={{ pl: 2, pr: 2, py: 0 }}>

          {/* 代码风格选择 */}
          <ListItem sx={{ px: 1, py: 1.5, flexDirection: 'column', alignItems: 'flex-start' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, width: '100%' }}>
              <Palette size={20} color="#666" style={{ marginRight: 8 }} />
              <Typography variant="body2" fontWeight="medium">
                代码风格
              </Typography>
            </Box>

            <FormControl fullWidth size="small">
              <Select
                value={codeStyle}
                onChange={(e) => dispatch(setCodeStyle(e.target.value))}
                sx={{ fontSize: '0.875rem' }}
                MenuProps={{
                  PaperProps: {
                    sx: { maxHeight: 400 }
                  }
                }}
              >
                {/* 自动和经典主题 */}
                <ListSubheader sx={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'primary.main' }}>
                  经典主题
                </ListSubheader>
                {CODE_STYLES.slice(0, 9).map((style) => (
                  <MenuItem key={style.value} value={style.value}>
                    <Box>
                      <Typography variant="body2" fontWeight="medium">
                        {style.label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {style.description}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}

                {/* 流行编辑器主题 */}
                <ListSubheader sx={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'primary.main' }}>
                  编辑器主题
                </ListSubheader>
                {CODE_STYLES.slice(9, 15).map((style) => (
                  <MenuItem key={style.value} value={style.value}>
                    <Box>
                      <Typography variant="body2" fontWeight="medium">
                        {style.label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {style.description}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}

                {/* Material 系列 */}
                <ListSubheader sx={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'primary.main' }}>
                  Material 系列
                </ListSubheader>
                {CODE_STYLES.slice(15, 18).map((style) => (
                  <MenuItem key={style.value} value={style.value}>
                    <Box>
                      <Typography variant="body2" fontWeight="medium">
                        {style.label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {style.description}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}

                {/* Duotone 系列 */}
                <ListSubheader sx={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'primary.main' }}>
                  Duotone 系列
                </ListSubheader>
                {CODE_STYLES.slice(18, 24).map((style) => (
                  <MenuItem key={style.value} value={style.value}>
                    <Box>
                      <Typography variant="body2" fontWeight="medium">
                        {style.label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {style.description}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}

                {/* 特色主题 */}
                <ListSubheader sx={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'primary.main' }}>
                  特色主题
                </ListSubheader>
                {CODE_STYLES.slice(24).map((style) => (
                  <MenuItem key={style.value} value={style.value}>
                    <Box>
                      <Typography variant="body2" fontWeight="medium">
                        {style.label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {style.description}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {selectedStyle && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                当前: {selectedStyle.description}
              </Typography>
            )}
          </ListItem>

          {/* 代码编辑 */}
          <ListItem sx={{ px: 1, py: 1 }}>
            <ListItemIcon sx={{ minWidth: '36px' }}>
              <Edit size={20} color="#666" />
            </ListItemIcon>
            <ListItemText
              primary="代码编辑"
              secondary="启用代码块编辑功能"
              primaryTypographyProps={{ variant: 'body2', fontWeight: 'medium' }}
              secondaryTypographyProps={{ variant: 'caption' }}
            />
            <CustomSwitch
              checked={codeEditor}
              onChange={(e) => dispatch(setCodeEditor(e.target.checked))}
            />
          </ListItem>

          {/* 代码显示行号 */}
          <ListItem sx={{ px: 1, py: 1 }}>
            <ListItemText
              primary="代码显示行号"
              secondary="在代码块左侧显示行号"
              primaryTypographyProps={{ variant: 'body2', fontWeight: 'medium' }}
              secondaryTypographyProps={{ variant: 'caption' }}
              sx={{ pl: 4.5 }}
            />
            <CustomSwitch
              checked={codeShowLineNumbers}
              onChange={(e) => dispatch(setCodeShowLineNumbers(e.target.checked))}
            />
          </ListItem>

          {/* 代码可折叠 */}
          <ListItem sx={{ px: 1, py: 1 }}>
            <ListItemText
              primary="代码可折叠"
              secondary="长代码块可以折叠显示"
              primaryTypographyProps={{ variant: 'body2', fontWeight: 'medium' }}
              secondaryTypographyProps={{ variant: 'caption' }}
              sx={{ pl: 4.5 }}
            />
            <CustomSwitch
              checked={codeCollapsible}
              onChange={(e) => dispatch(setCodeCollapsible(e.target.checked))}
            />
          </ListItem>

          {/* 代码可换行 */}
          <ListItem sx={{ px: 1, py: 1 }}>
            <ListItemText
              primary="代码可换行"
              secondary="长代码行可以自动换行"
              primaryTypographyProps={{ variant: 'body2', fontWeight: 'medium' }}
              secondaryTypographyProps={{ variant: 'caption' }}
              sx={{ pl: 4.5 }}
            />
            <CustomSwitch
              checked={codeWrappable}
              onChange={(e) => dispatch(setCodeWrappable(e.target.checked))}
            />
          </ListItem>

          {/* 默认收起代码块 */}
          <ListItem sx={{ px: 1, py: 1 }}>
            <ListItemText
              primary="默认收起代码块"
              secondary="新代码块默认以折叠状态显示"
              primaryTypographyProps={{ variant: 'body2', fontWeight: 'medium' }}
              secondaryTypographyProps={{ variant: 'caption' }}
              sx={{ pl: 4.5 }}
            />
            <CustomSwitch
              checked={codeDefaultCollapsed}
              onChange={(e) => dispatch(setCodeDefaultCollapsed(e.target.checked))}
            />
          </ListItem>

          {/* Mermaid图表功能 */}
          <ListItem sx={{ px: 1, py: 1 }}>
            <ListItemText
              primary="Mermaid图表"
              secondary="启用Mermaid图表渲染功能"
              primaryTypographyProps={{ variant: 'body2', fontWeight: 'medium' }}
              secondaryTypographyProps={{ variant: 'caption' }}
              sx={{ pl: 4.5 }}
            />
            <CustomSwitch
              checked={mermaidEnabled}
              onChange={(e) => dispatch(setMermaidEnabled(e.target.checked))}
            />
          </ListItem>

        </List>
      </Collapse>
    </>
  );
};

export default CodeBlockSettings;
