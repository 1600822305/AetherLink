import React, { useCallback } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Paper,

  List,
  ListItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import { Eye, EyeOff, GripVertical } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';

interface ButtonConfig {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  description: string;
  color: string;
}

interface DraggableButtonConfigProps {
  availableButtons: ButtonConfig[];
  leftButtons: string[];
  rightButtons: string[];
  onUpdateLayout: (leftButtons: string[], rightButtons: string[]) => void;
}

const DraggableButtonConfig: React.FC<DraggableButtonConfigProps> = ({
  availableButtons,
  leftButtons,
  rightButtons,
  onUpdateLayout
}) => {
  // 创建按钮映射
  const buttonMap = React.useMemo(() => {
    const map = new Map<string, ButtonConfig>();
    availableButtons.forEach(button => {
      map.set(button.id, button);
    });
    return map;
  }, [availableButtons]);

  // 获取未使用的按钮列表
  const unusedButtons = availableButtons.filter(button =>
    !leftButtons.includes(button.id) && !rightButtons.includes(button.id)
  );

  const handleToggleVisibility = useCallback((buttonId: string) => {
    const isInLeft = leftButtons.includes(buttonId);
    const isInRight = rightButtons.includes(buttonId);

    if (isInLeft || isInRight) {
      // 隐藏按钮 - 从对应列表中移除
      const newLeftButtons = leftButtons.filter(id => id !== buttonId);
      const newRightButtons = rightButtons.filter(id => id !== buttonId);
      onUpdateLayout(newLeftButtons, newRightButtons);
    } else {
      // 显示按钮 - 默认添加到左侧
      onUpdateLayout([...leftButtons, buttonId], rightButtons);
    }
  }, [leftButtons, rightButtons, onUpdateLayout]);

  const handleDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;

    // 如果在同一个列表内重新排序
    if (source.droppableId === destination.droppableId) {
      if (source.droppableId === 'left-buttons') {
        const newLeftButtons = Array.from(leftButtons);
        newLeftButtons.splice(source.index, 1);
        newLeftButtons.splice(destination.index, 0, draggableId);
        onUpdateLayout(newLeftButtons, rightButtons);
      } else if (source.droppableId === 'right-buttons') {
        const newRightButtons = Array.from(rightButtons);
        newRightButtons.splice(source.index, 1);
        newRightButtons.splice(destination.index, 0, draggableId);
        onUpdateLayout(leftButtons, newRightButtons);
      }
      // 未使用按钮区域内的排序不需要处理，因为顺序不重要
    } else {
      // 在不同列表间移动
      if (source.droppableId === 'left-buttons' && destination.droppableId === 'right-buttons') {
        // 从左侧移动到右侧
        const newLeftButtons = leftButtons.filter(id => id !== draggableId);
        const newRightButtons = Array.from(rightButtons);
        newRightButtons.splice(destination.index, 0, draggableId);
        onUpdateLayout(newLeftButtons, newRightButtons);
      } else if (source.droppableId === 'right-buttons' && destination.droppableId === 'left-buttons') {
        // 从右侧移动到左侧
        const newRightButtons = rightButtons.filter(id => id !== draggableId);
        const newLeftButtons = Array.from(leftButtons);
        newLeftButtons.splice(destination.index, 0, draggableId);
        onUpdateLayout(newLeftButtons, newRightButtons);
      } else if (source.droppableId === 'unused-buttons') {
        // 从未使用列表拖拽到左侧或右侧
        if (destination.droppableId === 'left-buttons') {
          const newLeftButtons = Array.from(leftButtons);
          newLeftButtons.splice(destination.index, 0, draggableId);
          onUpdateLayout(newLeftButtons, rightButtons);
        } else if (destination.droppableId === 'right-buttons') {
          const newRightButtons = Array.from(rightButtons);
          newRightButtons.splice(destination.index, 0, draggableId);
          onUpdateLayout(leftButtons, newRightButtons);
        }
      } else if (destination.droppableId === 'unused-buttons') {
        // 从左侧或右侧拖拽回未使用列表（移除按钮）
        if (source.droppableId === 'left-buttons') {
          const newLeftButtons = leftButtons.filter(id => id !== draggableId);
          onUpdateLayout(newLeftButtons, rightButtons);
        } else if (source.droppableId === 'right-buttons') {
          const newRightButtons = rightButtons.filter(id => id !== draggableId);
          onUpdateLayout(leftButtons, newRightButtons);
        }
      }
    }
  }, [leftButtons, rightButtons, onUpdateLayout]);

  const renderButtonItem = (button: ButtonConfig, index: number, isVisible: boolean) => {
    const IconComponent = button.icon;

    return (
      <Draggable key={button.id} draggableId={button.id} index={index}>
        {(provided, snapshot) => (
          <ListItem
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            sx={{
              mb: 1,
              bgcolor: snapshot.isDragging ? 'primary.light' : 'background.paper',
              borderRadius: 1,
              border: '1px solid',
              borderColor: snapshot.isDragging ? 'primary.main' : 'divider',
              transform: snapshot.isDragging ? 'rotate(2deg)' : 'none',
              transition: 'all 0.2s ease',
              opacity: isVisible ? 1 : 0.6,
              cursor: 'grab',
              '&:active': { cursor: 'grabbing' },
              '&:hover': {
                borderColor: 'primary.main',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }
            }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              <GripVertical size={16} color="rgba(0,0,0,0.4)" />
            </ListItemIcon>

            <ListItemIcon sx={{ minWidth: 40 }}>
              <IconComponent size={20} color={button.color} />
            </ListItemIcon>

            <ListItemText
              primary={
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {button.label}
                </Typography>
              }
              secondary={button.description}
              sx={{ flex: 1 }}
            />

            <IconButton
              edge="end"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleToggleVisibility(button.id);
              }}
              sx={{
                color: isVisible ? 'primary.main' : 'text.disabled',
                ml: 1,
                '&:hover': {
                  bgcolor: isVisible ? 'primary.light' : 'action.hover'
                }
              }}
            >
              {isVisible ? <Eye size={18} /> : <EyeOff size={18} />}
            </IconButton>
          </ListItem>
        )}
      </Draggable>
    );
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
        {/* 左侧按钮区域 */}
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle1" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
            左侧按钮
            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
              ({leftButtons.length} 个)
            </Typography>
          </Typography>

          <Paper sx={{ p: 1, minHeight: 200, backgroundColor: 'rgba(25, 118, 210, 0.02)' }}>
            <Droppable droppableId="left-buttons">
              {(provided) => (
                <List
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  sx={{ minHeight: 150 }}
                >
                  {leftButtons.map((buttonId, index) => {
                    const button = buttonMap.get(buttonId);
                    if (!button) return null;
                    return renderButtonItem(button, index, true);
                  })}
                  {provided.placeholder}
                  {leftButtons.length === 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                      拖拽按钮到这里
                    </Typography>
                  )}
                </List>
              )}
            </Droppable>
          </Paper>
        </Box>

        {/* 右侧按钮区域 */}
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle1" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
            右侧按钮
            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
              ({rightButtons.length} 个)
            </Typography>
          </Typography>

          <Paper sx={{ p: 1, minHeight: 200, backgroundColor: 'rgba(76, 175, 80, 0.02)' }}>
            <Droppable droppableId="right-buttons">
              {(provided) => (
                <List
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  sx={{ minHeight: 150 }}
                >
                  {rightButtons.map((buttonId, index) => {
                    const button = buttonMap.get(buttonId);
                    if (!button) return null;
                    return renderButtonItem(button, index, true);
                  })}
                  {provided.placeholder}
                  {rightButtons.length === 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                      拖拽按钮到这里
                    </Typography>
                  )}
                </List>
              )}
            </Droppable>
          </Paper>
        </Box>
      </Box>

      {/* 可用按钮区域 - 始终显示 */}
      <Box sx={{ mt: 3 }}>
        <Typography variant="subtitle1" sx={{ mb: 2 }}>
          可用按钮 ({unusedButtons.length} 个)
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          拖拽按钮到上方左右区域来使用，或拖拽已使用的按钮回到这里来移除
        </Typography>
        <Paper sx={{ p: 1, minHeight: 100, backgroundColor: 'rgba(158, 158, 158, 0.02)' }}>
          <Droppable droppableId="unused-buttons">
            {(provided, snapshot) => (
              <List
                ref={provided.innerRef}
                {...provided.droppableProps}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                  gap: 1,
                  minHeight: 80,
                  backgroundColor: snapshot.isDraggingOver ? 'rgba(158, 158, 158, 0.1)' : 'transparent',
                  borderRadius: 1,
                  transition: 'background-color 0.2s ease'
                }}
              >
                {unusedButtons.map((button, index) =>
                  renderButtonItem(button, index, false)
                )}
                {provided.placeholder}
                {unusedButtons.length === 0 && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      textAlign: 'center',
                      py: 4,
                      gridColumn: '1 / -1',
                      fontStyle: 'italic'
                    }}
                  >
                    {snapshot.isDraggingOver ? '松开鼠标移除按钮' : '所有按钮都已使用，拖拽按钮到这里可以移除'}
                  </Typography>
                )}
              </List>
            )}
          </Droppable>
        </Paper>
      </Box>
    </DragDropContext>
  );
};

export default DraggableButtonConfig;
