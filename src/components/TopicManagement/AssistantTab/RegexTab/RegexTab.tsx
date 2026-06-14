import React, { useState, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  useTheme,
  Snackbar,
  Alert
} from '@mui/material';
import { Plus, Wand2, Upload } from 'lucide-react';
import { importSillyTavernRegexScripts } from '../../../../shared/utils/sillyTavernRegexImport';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { AssistantRegex } from '../../../../shared/types/Assistant';
import RegexRuleCard from './RegexRuleCard';
import RegexRuleDialog from './RegexRuleDialog';
import { createLogger } from '../../../../shared/services/infra/logger';

const logger = createLogger('RegexTab');

export interface RegexTabProps {
  rules: AssistantRegex[];
  onChange: (rules: AssistantRegex[]) => void;
}

/**
 * 可排序的规则项包装组件
 */
const SortableRuleItem: React.FC<{
  rule: AssistantRegex;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: (enabled: boolean) => void;
}> = ({ rule, onEdit, onDelete, onToggle }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: rule.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto'
  };

  return (
    <Box ref={setNodeRef} style={style} sx={{ mb: 1.5 }}>
      <RegexRuleCard
        rule={rule}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggle={onToggle}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </Box>
  );
};

/**
 * 正则替换 Tab 组件
 */
const RegexTab: React.FC<RegexTabProps> = ({ rules, onChange }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AssistantRegex | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 处理导入酒馆正则
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      const importedRules = importSillyTavernRegexScripts(content);
      
      if (importedRules.length === 0) {
        setSnackbar({ open: true, message: '没有找到有效的正则规则', severity: 'error' });
        return;
      }

      // 合并导入的规则
      onChange([...rules, ...importedRules]);
      setSnackbar({ open: true, message: `成功导入 ${importedRules.length} 条正则规则`, severity: 'success' });
    } catch (error) {
      logger.error('导入失败:', error);
      setSnackbar({ open: true, message: `导入失败: ${(error as Error).message}`, severity: 'error' });
    } finally {
      // 清空文件输入
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // 拖拽传感器配置
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  // 处理拖拽结束
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = rules.findIndex(r => r.id === active.id);
      const newIndex = rules.findIndex(r => r.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        onChange(arrayMove(rules, oldIndex, newIndex));
      }
    }
  };

  // 添加规则
  const handleAddRule = () => {
    setEditingRule(null);
    setDialogOpen(true);
  };

  // 编辑规则
  const handleEditRule = (rule: AssistantRegex) => {
    setEditingRule(rule);
    setDialogOpen(true);
  };

  // 保存规则
  const handleSaveRule = (rule: AssistantRegex) => {
    if (editingRule) {
      // 更新现有规则
      onChange(rules.map(r => r.id === rule.id ? rule : r));
    } else {
      // 添加新规则
      onChange([...rules, rule]);
    }
  };

  // 删除规则
  const handleDeleteRule = (ruleId: string) => {
    onChange(rules.filter(r => r.id !== ruleId));
  };

  // 切换规则启用状态
  const handleToggleRule = (ruleId: string, enabled: boolean) => {
    onChange(rules.map(r => r.id === ruleId ? { ...r, enabled } : r));
  };

  // 空状态
  if (rules.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          py: 6,
          px: 3
        }}
      >
        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 2
          }}
        >
          <Wand2 size={28} color={theme.palette.primary.main} style={{ opacity: 0.7 }} />
        </Box>
        <Typography
          variant="body2"
          sx={{
            color: theme.palette.text.secondary,
            textAlign: 'center',
            mb: 3,
            maxWidth: 280
          }}
        >
          正则替换可以自动处理消息内容，如隐藏敏感信息、格式化文本等
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Button
            variant="outlined"
            startIcon={<Plus size={18} />}
            onClick={handleAddRule}
            sx={{
              borderRadius: '10px',
              textTransform: 'none',
              px: 3
            }}
          >
            添加正则规则
          </Button>
          <Button
            variant="outlined"
            startIcon={<Upload size={18} />}
            onClick={handleImportClick}
            sx={{
              borderRadius: '10px',
              textTransform: 'none',
              px: 3,
              borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'
            }}
          >
            导入酒馆正则
          </Button>
        </Box>

        {/* 隐藏的文件输入 */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        <RegexRuleDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onSave={handleSaveRule}
          rule={editingRule}
        />

        {/* 提示消息 */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 顶部说明和添加按钮 */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2
        }}
      >
        <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
          拖拽调整规则执行顺序
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size="small"
            startIcon={<Upload size={14} />}
            onClick={handleImportClick}
            sx={{
              borderRadius: '8px',
              textTransform: 'none',
              fontSize: '0.75rem',
              color: theme.palette.text.secondary
            }}
          >
            导入
          </Button>
          <Button
            size="small"
            startIcon={<Plus size={16} />}
            onClick={handleAddRule}
            sx={{
              borderRadius: '8px',
              textTransform: 'none',
              fontSize: '0.8rem'
            }}
          >
            添加
          </Button>
        </Box>
      </Box>

      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* 规则列表 */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={rules.map(r => r.id)} strategy={verticalListSortingStrategy}>
            {rules.map(rule => (
              <SortableRuleItem
                key={rule.id}
                rule={rule}
                onEdit={() => handleEditRule(rule)}
                onDelete={() => handleDeleteRule(rule.id)}
                onToggle={(enabled) => handleToggleRule(rule.id, enabled)}
              />
            ))}
          </SortableContext>
        </DndContext>
      </Box>

      {/* 编辑对话框 */}
      <RegexRuleDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={handleSaveRule}
        rule={editingRule}
      />

      {/* 提示消息 */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default RegexTab;
