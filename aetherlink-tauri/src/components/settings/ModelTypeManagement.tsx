import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  FormControlLabel,
  Checkbox,
  IconButton,
  Chip,
  Alert,
} from '@mui/material';
import { Trash2 as DeleteIcon, Plus as AddIcon } from 'lucide-react';
import { ModelType } from '../../shared/types';
import type { ModelTypeRule } from '../../shared/types';
import { matchModelTypes, getModelTypeDisplayName } from '../../shared/data/modelTypeRules';

interface ModelTypeManagementProps {
  open: boolean;
  onClose: () => void;
  rules: ModelTypeRule[];
  onSave: (rules: ModelTypeRule[]) => void;
  modelId?: string;
  provider?: string;
}

const ModelTypeManagement: React.FC<ModelTypeManagementProps> = ({
  open,
  onClose,
  rules,
  onSave,
  modelId,
  provider,
}) => {
  const [localRules, setLocalRules] = useState<ModelTypeRule[]>([]);
  const [newRule, setNewRule] = useState<ModelTypeRule>({
    pattern: '',
    types: [ModelType.Chat],
  });
  const [testResult, setTestResult] = useState<ModelType[]>([]);
  const [editMode, setEditMode] = useState<boolean>(false);

  // 初始化本地规则
  useEffect(() => {
    if (open) {
      setLocalRules(rules || []);
      setEditMode(false);
    }
  }, [open, rules]);

  // 处理规则变更
  const handleRuleChange = (index: number, field: keyof ModelTypeRule, value: any) => {
    const updatedRules = [...localRules];

    if (field === 'types') {
      updatedRules[index] = {
        ...updatedRules[index],
        types: value,
      };
    } else {
      updatedRules[index] = {
        ...updatedRules[index],
        [field]: value,
      };
    }

    setLocalRules(updatedRules);
  };

  // 处理新规则变更
  const handleNewRuleChange = (field: keyof ModelTypeRule, value: any) => {
    if (field === 'types') {
      setNewRule({
        ...newRule,
        types: value,
      });
    } else {
      setNewRule({
        ...newRule,
        [field]: value,
      });
    }
  };

  // 添加新规则
  const addNewRule = () => {
    if (newRule.pattern.trim() === '') {
      return;
    }

    if (newRule.types.length === 0) {
      setNewRule({
        ...newRule,
        types: [ModelType.Chat],
      });
      return;
    }

    setLocalRules([...localRules, newRule]);
    setNewRule({
      pattern: '',
      types: [ModelType.Chat],
    });
  };

  // 删除规则
  const deleteRule = (index: number) => {
    const updatedRules = [...localRules];
    updatedRules.splice(index, 1);
    setLocalRules(updatedRules);
  };

  // 测试规则
  const testRules = () => {
    if (modelId && provider) {
      const types = matchModelTypes(modelId, provider, localRules);
      setTestResult(types);
    }
  };

  // 处理类型选择变化
  const handleTypeChange = (index: number, type: ModelType, checked: boolean) => {
    const rule = localRules[index];
    let newTypes = [...rule.types];

    if (checked) {
      if (!newTypes.includes(type)) {
        newTypes.push(type);
      }
    } else {
      newTypes = newTypes.filter(t => t !== type);
      // 至少保留一个类型
      if (newTypes.length === 0) {
        newTypes = [ModelType.Chat];
      }
    }

    handleRuleChange(index, 'types', newTypes);
  };

  // 处理新规则类型选择变化
  const handleNewTypeChange = (type: ModelType, checked: boolean) => {
    let newTypes = [...newRule.types];

    if (checked) {
      if (!newTypes.includes(type)) {
        newTypes.push(type);
      }
    } else {
      newTypes = newTypes.filter(t => t !== type);
      // 至少保留一个类型
      if (newTypes.length === 0) {
        newTypes = [ModelType.Chat];
      }
    }

    handleNewRuleChange('types', newTypes);
  };

  // 保存规则
  const handleSave = () => {
    onSave(localRules);
    onClose();
  };

  // 切换编辑模式
  const toggleEditMode = () => {
    setEditMode(!editMode);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">模型类型管理</Typography>
          <Button
            color={editMode ? "primary" : "secondary"}
            onClick={toggleEditMode}
          >
            {editMode ? "完成编辑" : "编辑规则"}
          </Button>
        </Box>
      </DialogTitle>
      <DialogContent>
        {editMode ? (
          <Box>
            <Typography variant="subtitle1" gutterBottom>
              编辑模型类型匹配规则
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              规则按顺序匹配，第一条匹配成功的规则将被应用。
            </Typography>

            {/* 规则列表 */}
            <Box sx={{ mb: 3 }}>
              {localRules.map((rule, index) => (
                <Box
                  key={index}
                  sx={{
                    p: 2,
                    mb: 2,
                    border: '1px solid #e0e0e0',
                    borderRadius: 1,
                    backgroundColor: '#f9f9f9',
                  }}
                >
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box>
                      <TextField
                        fullWidth
                        label="匹配模式"
                        value={rule.pattern}
                        onChange={(e) => handleRuleChange(index, 'pattern', e.target.value)}
                        helperText="支持正则表达式或简单字符串"
                        size="small"
                      />
                    </Box>
                    <IconButton color="error" onClick={() => deleteRule(index)}>
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                  <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
                    <Box>
                      <TextField
                        fullWidth
                        label="提供商限制（可选）"
                        value={rule.provider || ''}
                        onChange={(e) => handleRuleChange(index, 'provider', e.target.value || undefined)}
                        placeholder="例如: openai, google"
                        size="small"
                      />
                    </Box>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {Object.values(ModelType).map((type) => (
                        <FormControlLabel
                          key={type}
                          control={
                            <Checkbox
                              checked={rule.types.includes(type)}
                              onChange={(e) => handleTypeChange(index, type, e.target.checked)}
                              size="small"
                            />
                          }
                          label={getModelTypeDisplayName(type)}
                        />
                      ))}
                    </Box>
                  </Box>
                </Box>
              ))}
            </Box>

            {/* 添加新规则 */}
            <Box
              sx={{
                p: 2,
                mb: 2,
                border: '1px dashed #a0a0a0',
                borderRadius: 1,
              }}
            >
              <Typography variant="subtitle2" gutterBottom>
                添加新规则
              </Typography>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <TextField
                    fullWidth
                    label="匹配模式"
                    value={newRule.pattern}
                    onChange={(e) => handleNewRuleChange('pattern', e.target.value)}
                    helperText="支持正则表达式或简单字符串"
                    size="small"
                  />
                </Box>
                <IconButton color="primary" onClick={addNewRule}>
                  <AddIcon />
                </IconButton>
              </Box>
              <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
                <Box>
                  <TextField
                    fullWidth
                    label="提供商限制（可选）"
                    value={newRule.provider || ''}
                    onChange={(e) => handleNewRuleChange('provider', e.target.value || undefined)}
                    placeholder="例如: openai, google"
                    size="small"
                  />
                </Box>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {Object.values(ModelType).map((type) => (
                    <FormControlLabel
                      key={type}
                      control={
                        <Checkbox
                          checked={newRule.types.includes(type)}
                          onChange={(e) => handleNewTypeChange(type, e.target.checked)}
                          size="small"
                        />
                      }
                      label={getModelTypeDisplayName(type)}
                    />
                  ))}
                </Box>
              </Box>
            </Box>
          </Box>
        ) : (
          <Box>
            {/* 当前规则视图 */}
            <Typography variant="subtitle1" gutterBottom>
              当前模型类型匹配规则
            </Typography>
            {localRules.length > 0 ? (
              localRules.map((rule, index) => (
                <Box
                  key={index}
                  sx={{
                    p: 2,
                    mb: 2,
                    border: '1px solid #e0e0e0',
                    borderRadius: 1,
                    backgroundColor: '#f9f9f9',
                  }}
                >
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="body2">
                        <strong>匹配模式:</strong> {rule.pattern}
                      </Typography>
                      {rule.provider && (
                        <Typography variant="body2">
                          <strong>提供商:</strong> {rule.provider}
                        </Typography>
                      )}
                    </Box>
                    <IconButton color="error" onClick={() => deleteRule(index)}>
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                  <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
                    <Box>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>适用类型:</strong>
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {rule.types.map((type) => (
                        <Chip
                          key={type}
                          label={getModelTypeDisplayName(type)}
                          size="small"
                          sx={{ mr: 0.5, mb: 0.5 }}
                        />
                      ))}
                    </Box>
                  </Box>
                </Box>
              ))
            ) : (
              <Alert severity="info" sx={{ mt: 2 }}>
                尚未配置任何类型匹配规则，将使用默认规则。
              </Alert>
            )}

            {/* 测试区域 */}
            {modelId && provider && (
              <Box sx={{ mt: 4, p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  测试模型类型匹配
                </Typography>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="body2" sx={{ mr: 1 }}>
                    <strong>模型ID:</strong> {modelId}
                  </Typography>
                  <Typography variant="body2">
                    <strong>提供商:</strong> {provider}
                  </Typography>
                </Box>
                <Button
                  variant="outlined"
                  color="primary"
                  onClick={testRules}
                  size="small"
                >
                  测试匹配
                </Button>
                {testResult.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2">匹配结果:</Typography>
                    <Box display="flex" flexWrap="wrap" gap={0.5} sx={{ mt: 1 }}>
                      {testResult.map((type) => (
                        <Chip
                          key={type}
                          label={getModelTypeDisplayName(type)}
                          color="primary"
                          size="small"
                          sx={{ mr: 0.5, mb: 0.5 }}
                        />
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button onClick={handleSave} variant="contained" color="primary">
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ModelTypeManagement;