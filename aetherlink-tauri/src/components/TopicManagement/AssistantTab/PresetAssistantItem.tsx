import {
  ListItemButton,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Typography
} from '@mui/material';
import { useSelector } from 'react-redux';
import type { Assistant } from '../../../shared/types/Assistant';
import type { RootState } from '../../../shared/store';

interface PresetAssistantItemProps {
  assistant: Assistant;
  isSelected: boolean;
  onSelect: (assistantId: string) => void;
}

/**
 * 预设助手项组件 - 专用于添加助手对话框
 * 与普通AssistantItem的区别：点击时不会触发切换到话题标签页
 */
export default function PresetAssistantItem({
  assistant,
  isSelected,
  onSelect
}: PresetAssistantItemProps) {
  // 简单的点击处理，只选择助手ID，不切换标签页
  const handleClick = () => {
    onSelect(assistant.id);
  };

  // 直接从Redux读取最新话题数量
  const reduxAssistant = useSelector((state: RootState) =>
    state.assistants.assistants.find(a => a.id === assistant.id)
  );

  const topicCount = (reduxAssistant || assistant).topics?.length ||
                    (reduxAssistant || assistant).topicIds?.length || 0;

  return (
    <ListItemButton
      onClick={handleClick}
      selected={isSelected}
      sx={{
        borderRadius: '8px',
        mb: 1,
        '&.Mui-selected': {
          backgroundColor: 'rgba(25, 118, 210, 0.08)',
        },
        '&.Mui-selected:hover': {
          backgroundColor: 'rgba(25, 118, 210, 0.12)',
        }
      }}
    >
      <ListItemAvatar>
        <Avatar
          sx={{
            width: 32,
            height: 32,
            fontSize: '1rem',
            bgcolor: isSelected ? 'primary.main' : 'grey.300'
          }}
        >
          {assistant.emoji || assistant.name.charAt(0)}
        </Avatar>
      </ListItemAvatar>
      <ListItemText
        primary={
          <Typography
            variant="body2"
            sx={{
              fontWeight: isSelected ? 600 : 400,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {assistant.name}
          </Typography>
        }
        secondary={
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block' }}
          >
            {assistant.description || `${topicCount} 个话题`}
          </Typography>
        }
      />
    </ListItemButton>
  );
} 