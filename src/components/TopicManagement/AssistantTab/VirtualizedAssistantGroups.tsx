import React, { memo, useMemo, useCallback } from 'react';
import { Box, Typography, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import { ChevronDown } from 'lucide-react';
import VirtualScroller from '../../common/VirtualScroller';
import AssistantItem from './AssistantItem';
import type { Assistant } from '../../../shared/types/Assistant';
import type { Group } from '../../../shared/types';

interface VirtualizedAssistantGroupsProps {
  assistantGroups: Group[];
  userAssistants: Assistant[];
  assistantGroupMap: Record<string, string>;
  currentAssistant: Assistant | null;
  onSelectAssistant: (assistant: Assistant) => void;
  onOpenMenu: (event: React.MouseEvent, assistant: Assistant) => void;
  onDeleteAssistant: (assistantId: string, event: React.MouseEvent) => void;
  isGroupEditMode: boolean;
  onAddItem?: () => void;
}

/**
 * 虚拟化助手分组组件
 * 对于大量助手的分组使用虚拟化渲染
 */
const VirtualizedAssistantGroups = memo(function VirtualizedAssistantGroups({
  assistantGroups,
  userAssistants,
  assistantGroupMap,
  currentAssistant,
  onSelectAssistant,
  onOpenMenu,
  onDeleteAssistant
}: VirtualizedAssistantGroupsProps) {
  
  // 使用 useMemo 缓存分组助手的计算结果
  const groupedAssistants = useMemo(() => {
    return assistantGroups.map((group) => {
      const groupAssistants = userAssistants.filter(
        assistant => assistant && assistant.id && assistantGroupMap[assistant.id] === group.id
      );
      return {
        group,
        assistants: groupAssistants,
        shouldVirtualize: groupAssistants.length > 15 // 超过15个助手时启用虚拟化
      };
    });
  }, [assistantGroups, userAssistants, assistantGroupMap]);

  // 缓存助手项渲染函数
  const renderAssistantItem = useCallback((assistant: Assistant, _index: number) => {
    return (
      <AssistantItem
        assistant={assistant}
        isSelected={currentAssistant?.id === assistant.id}
        onSelectAssistant={onSelectAssistant}
        onOpenMenu={onOpenMenu}
        onDeleteAssistant={onDeleteAssistant}
      />
    );
  }, [currentAssistant?.id, onSelectAssistant, onOpenMenu, onDeleteAssistant]);

  // 缓存助手键值函数
  const getAssistantKey = useCallback((assistant: Assistant, _index: number) => {
    return assistant.id;
  }, []);

  // 渲染单个分组
  const renderGroup = useCallback(({ group, assistants: groupAssistants, shouldVirtualize }: {
    group: Group;
    assistants: Assistant[];
    shouldVirtualize: boolean;
  }) => {
    return (
      <Accordion
        key={group.id}
        defaultExpanded={Boolean(group.expanded)}
        disableGutters
        sx={{
          mb: 1,
          boxShadow: 'none',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: '8px',
          '&:before': {
            display: 'none',
          },
        }}
      >
        <AccordionSummary
          expandIcon={<ChevronDown size={20} />}
          sx={{
            minHeight: '48px',
            '& .MuiAccordionSummary-content': {
              margin: '8px 0',
            }
          }}
        >
          <Typography variant="body2">
            {group.name} ({groupAssistants.length})
            {shouldVirtualize && ' 🚀'}
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ p: 1 }}>
          {groupAssistants.length > 0 ? (
            shouldVirtualize ? (
              // 使用虚拟化渲染大量助手
              <VirtualScroller
                items={groupAssistants}
                itemHeight={72}
                renderItem={renderAssistantItem}
                itemKey={getAssistantKey}
                height={300} // 限制分组内容的最大高度
                overscanCount={3}
                style={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: '4px',
                  backgroundColor: 'background.default',
                }}
              />
            ) : (
              // 助手数量较少时直接渲染
              <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                {groupAssistants.map((assistant) => (
                  <Box key={assistant.id} sx={{ mb: 1 }}>
                    {renderAssistantItem(assistant, 0)}
                  </Box>
                ))}
              </Box>
            )
          ) : (
            <Typography
              variant="body2"
              color="textSecondary"
              sx={{
                py: 1,
                px: 1,
                textAlign: 'center',
                fontStyle: 'italic',
                fontSize: '0.85rem'
              }}
            >
              此分组暂无助手，请从未分组助手中添加
            </Typography>
          )}
        </AccordionDetails>
      </Accordion>
    );
  }, [renderAssistantItem, getAssistantKey]);

  if (groupedAssistants.length === 0) {
    return (
      <Typography variant="body2" color="textSecondary" sx={{ py: 2, textAlign: 'center' }}>
        没有助手分组
      </Typography>
    );
  }

  return (
    <Box sx={{ mb: 2 }}>
      {groupedAssistants.map(renderGroup)}
    </Box>
  );
});

export default VirtualizedAssistantGroups;
