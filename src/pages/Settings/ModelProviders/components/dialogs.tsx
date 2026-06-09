import React, { useState } from 'react';
import {
  Box,
  Button,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Stack,
  Snackbar,
  Alert,
  Tabs,
  Tab
} from '@mui/material';
import BackButtonDialog from '../../../../components/common/BackButtonDialog';
import { alpha } from '@mui/material/styles';
import { Plus, Trash2, CheckCircle } from 'lucide-react';
import { providerTypeOptions } from './constants';
import { useTranslation } from 'react-i18next';
// ============================================================================
// 类型定义
// ============================================================================

interface AddModelDialogProps {
  open: boolean;
  onClose: () => void;
  newModelName: string;
  newModelValue: string;
  onModelNameChange: (value: string) => void;
  onModelValueChange: (value: string) => void;
  onAddModel: () => void;
}

interface DeleteDialogProps {
  open: boolean;
  onClose: () => void;
  providerName: string;
  onDelete: () => void;
}

interface EditProviderDialogProps {
  open: boolean;
  onClose: () => void;
  providerName: string;
  providerType: string;
  onProviderNameChange: (value: string) => void;
  onProviderTypeChange: (value: string) => void;
  onSave: () => void;
}

interface AdvancedAPIConfigDialogProps {
  open: boolean;
  onClose: () => void;
  // Headers
  extraHeaders: Record<string, string>;
  newHeaderKey: string;
  newHeaderValue: string;
  onNewHeaderKeyChange: (value: string) => void;
  onNewHeaderValueChange: (value: string) => void;
  onAddHeader: () => void;
  onRemoveHeader: (key: string) => void;
  onUpdateHeader: (oldKey: string, newKey: string, newValue: string) => void;
  onSetExtraHeaders: (headers: Record<string, string>) => void;
  // Body
  extraBody: Record<string, any>;
  newBodyKey: string;
  newBodyValue: string;
  onNewBodyKeyChange: (value: string) => void;
  onNewBodyValueChange: (value: string) => void;
  onAddBody: () => void;
  onRemoveBody: (key: string) => void;
  onUpdateBody: (oldKey: string, newKey: string, newValue: string) => void;
}

interface HeadersDialogProps {
  open: boolean;
  onClose: () => void;
  extraHeaders: Record<string, string>;
  newHeaderKey: string;
  newHeaderValue: string;
  onNewHeaderKeyChange: (value: string) => void;
  onNewHeaderValueChange: (value: string) => void;
  onAddHeader: () => void;
  onRemoveHeader: (key: string) => void;
  onUpdateHeader: (oldKey: string, newKey: string, newValue: string) => void;
  onSetExtraHeaders: (headers: Record<string, string>) => void;
}

interface CustomBodyDialogProps {
  open: boolean;
  onClose: () => void;
  extraBody: Record<string, any>;
  newBodyKey: string;
  newBodyValue: string;
  onNewBodyKeyChange: (value: string) => void;
  onNewBodyValueChange: (value: string) => void;
  onAddBody: () => void;
  onRemoveBody: (key: string) => void;
  onUpdateBody: (oldKey: string, newKey: string, newValue: string) => void;
}

interface CustomEndpointDialogProps {
  open: boolean;
  onClose: () => void;
  customEndpoint: string;
  customEndpointError: string;
  onCustomEndpointChange: (value: string) => void;
  onSave: () => void;
}

interface TestResultSnackbarProps {
  open: boolean;
  testResult: { success: boolean; message: string } | null;
  testResultDialogOpen: boolean;
  onClose: () => void;
  onOpenDialog: () => void;
}

interface TestResultDialogProps {
  open: boolean;
  onClose: () => void;
  testResult: { success: boolean; message: string } | null;
}

// ============================================================================
// 添加模型对话框
// ============================================================================

export const AddModelDialog: React.FC<AddModelDialogProps> = ({
  open,
  onClose,
  newModelName,
  newModelValue,
  onModelNameChange,
  onModelValueChange,
  onAddModel
}) => {
  const { t } = useTranslation();
  
  return (
    <BackButtonDialog open={open} onClose={onClose}>
      <DialogTitle sx={{
        fontWeight: 600,
      }}>
        {t('modelSettings.dialogs.addModel.title')}
      </DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label={t('modelSettings.dialogs.addModel.modelName')}
          placeholder={t('modelSettings.dialogs.addModel.modelNamePlaceholder')}
          type="text"
          fullWidth
          variant="outlined"
          value={newModelName}
          onChange={(e) => onModelNameChange(e.target.value)}
          sx={{ mb: 2, mt: 2 }}
        />
        <TextField
          margin="dense"
          label={t('modelSettings.dialogs.addModel.modelId')}
          placeholder={t('modelSettings.dialogs.addModel.modelIdPlaceholder')}
          type="text"
          fullWidth
          variant="outlined"
          value={newModelValue}
          onChange={(e) => onModelValueChange(e.target.value)}
        />
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button
          onClick={onAddModel}
          disabled={!newModelName || !newModelValue}
          sx={{
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
            color: 'primary.main',
            '&:hover': {
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.2),
            },
            borderRadius: 2,
          }}
        >
          {t('modelSettings.dialogs.addModel.add')}
        </Button>
      </DialogActions>
    </BackButtonDialog>
  );
};

// ============================================================================
// 删除确认对话框
// ============================================================================

export const DeleteDialog: React.FC<DeleteDialogProps> = ({
  open,
  onClose,
  providerName,
  onDelete
}) => {
  const { t } = useTranslation();
  
  return (
    <BackButtonDialog open={open} onClose={onClose}>
      <DialogTitle fontWeight={600}>{t('modelSettings.dialogs.deleteProvider.title')}</DialogTitle>
      <DialogContent>
        <Typography>
          {t('modelSettings.dialogs.deleteProvider.message', { name: providerName }).split('<bold>').map((part, i) => {
            if (i === 0) return part;
            const [boldText, ...rest] = part.split('</bold>');
            return <React.Fragment key={i}><b>{boldText}</b>{rest.join('</bold>')}</React.Fragment>;
          })}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button
          onClick={onDelete}
          color="error"
          sx={{
            bgcolor: (theme) => alpha(theme.palette.error.main, 0.1),
            '&:hover': {
              bgcolor: (theme) => alpha(theme.palette.error.main, 0.2),
            },
            borderRadius: 2,
          }}
        >
          {t('common.delete')}
        </Button>
      </DialogActions>
    </BackButtonDialog>
  );
};

// ============================================================================
// 编辑供应商对话框
// ============================================================================

export const EditProviderDialog: React.FC<EditProviderDialogProps> = ({
  open,
  onClose,
  providerName,
  providerType,
  onProviderNameChange,
  onProviderTypeChange,
  onSave
}) => {
  const { t } = useTranslation();
  
  return (
    <BackButtonDialog open={open} onClose={onClose}>
      <DialogTitle sx={{
        fontWeight: 600,
      }}>
        {t('modelSettings.dialogs.editProvider.title')}
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <TextField
          autoFocus
          margin="dense"
          label={t('modelSettings.dialogs.editProvider.providerName')}
          placeholder={t('modelSettings.dialogs.editProvider.providerNamePlaceholder')}
          type="text"
          fullWidth
          variant="outlined"
          value={providerName}
          onChange={(e) => onProviderNameChange(e.target.value)}
          sx={{ mb: 2 }}
        />
        <FormControl fullWidth variant="outlined">
          <InputLabel>{t('modelSettings.dialogs.editProvider.providerType')}</InputLabel>
          <Select
            value={providerType}
            onChange={(e) => onProviderTypeChange(e.target.value)}
            label={t('modelSettings.dialogs.editProvider.providerType')}
          >
            {providerTypeOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button
          onClick={onSave}
          disabled={!providerName.trim()}
          sx={{
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
            color: 'primary.main',
            '&:hover': {
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.2),
            },
            borderRadius: 2,
          }}
        >
          {t('common.save')}
        </Button>
      </DialogActions>
    </BackButtonDialog>
  );
};

// ============================================================================
// 高级 API 配置对话框（合并版）
// ============================================================================

export const AdvancedAPIConfigDialog: React.FC<AdvancedAPIConfigDialogProps> = ({
  open,
  onClose,
  extraHeaders,
  newHeaderKey,
  newHeaderValue,
  onNewHeaderKeyChange,
  onNewHeaderValueChange,
  onAddHeader,
  onRemoveHeader,
  onUpdateHeader,
  onSetExtraHeaders,
  extraBody,
  newBodyKey,
  newBodyValue,
  onNewBodyKeyChange,
  onNewBodyValueChange,
  onAddBody,
  onRemoveBody,
  onUpdateBody
}) => {
  const { t } = useTranslation();
  const [currentTab, setCurrentTab] = useState(0);
  
  const headersEntries = Object.entries(extraHeaders);
  const hasHeaders = headersEntries.length > 0;
  
  const bodyEntries = Object.entries(extraBody);
  const hasBody = bodyEntries.length > 0;
  
  // 尝试解析JSON值，如果失败则返回原始字符串
  const formatBodyValue = (value: any): string => {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return value;
      }
    }
    return JSON.stringify(value, null, 2);
  };

  // 尝试解析输入值为JSON，如果失败则作为字符串处理
  const parseBodyValue = (value: string): any => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    
    try {
      return JSON.parse(trimmed);
    } catch {
      if (trimmed === 'true') return true;
      if (trimmed === 'false') return false;
      if (trimmed === 'null') return null;
      if (/^-?\d+$/.test(trimmed)) return parseInt(trimmed, 10);
      if (/^-?\d*\.\d+$/.test(trimmed)) return parseFloat(trimmed);
      return trimmed;
    }
  };
  
  return (
    <BackButtonDialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle
        sx={{
          fontWeight: 600,
          color: 'text.primary',
          pb: 0
        }}
      >
        {t('modelSettings.dialogs.advancedConfig.title')}
      </DialogTitle>
      
      <Tabs
        value={currentTab}
        onChange={(_, newValue) => setCurrentTab(newValue)}
        sx={{
          px: 3,
          borderBottom: 1,
          borderColor: 'divider'
        }}
      >
        <Tab label={t('modelSettings.dialogs.advancedConfig.headersTab')} />
        <Tab label={t('modelSettings.dialogs.advancedConfig.bodyTab')} />
      </Tabs>
      
      <DialogContent dividers sx={{ pt: 3 }}>
        {/* Headers Tab */}
        {currentTab === 0 && (
          <Stack spacing={3}>
            <Typography variant="body2" color="text.secondary">
              {t('modelSettings.dialogs.headers.description')}
            </Typography>

            <Paper
              variant="outlined"
              sx={(theme) => ({
                p: 2,
                borderRadius: 2,
                bgcolor: theme.palette.action.hover,
                display: 'flex',
                flexDirection: 'column',
                gap: theme.spacing(1.5),
              })}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {t('modelSettings.dialogs.headers.quickActions')}
              </Typography>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                sx={{
                  flexWrap: 'wrap',
                  '& > *': {
                    flex: { xs: '1 1 auto', sm: '0 0 auto' }
                  }
                }}
              >
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    onSetExtraHeaders({
                      ...extraHeaders,
                      'x-stainless-timeout': 'REMOVE'
                    });
                  }}
                  sx={{ borderRadius: 999 }}
                >
                  {t('modelSettings.dialogs.headers.disableTimeout')}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    onSetExtraHeaders({
                      ...extraHeaders,
                      'x-stainless-retry-count': 'REMOVE'
                    });
                  }}
                  sx={{ borderRadius: 999 }}
                >
                  {t('modelSettings.dialogs.headers.disableRetry')}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  onClick={() => {
                    onSetExtraHeaders({
                      ...extraHeaders,
                      'x-stainless-timeout': 'REMOVE',
                      'x-stainless-retry-count': 'REMOVE',
                      'x-stainless-arch': 'REMOVE',
                      'x-stainless-lang': 'REMOVE',
                      'x-stainless-os': 'REMOVE',
                      'x-stainless-package-version': 'REMOVE',
                      'x-stainless-runtime': 'REMOVE',
                      'x-stainless-runtime-version': 'REMOVE'
                    });
                  }}
                  sx={{ borderRadius: 999 }}
                >
                  {t('modelSettings.dialogs.headers.disableAll')}
                </Button>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {t('modelSettings.dialogs.headers.removeHint')}
              </Typography>
            </Paper>

            <Stack spacing={2}>
              {hasHeaders ? (
                headersEntries.map(([key, value]) => (
                  <Paper key={key} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: { xs: 'column', sm: 'row' },
                        gap: { xs: 2, sm: 1.5 },
                        alignItems: { sm: 'center' }
                      }}
                    >
                      <TextField
                        size="small"
                        label={t('modelSettings.dialogs.headers.headerName')}
                        value={key}
                        onChange={(e) => onUpdateHeader(key, e.target.value, value)}
                        sx={{ flex: 1 }}
                      />
                      <TextField
                        size="small"
                        label={t('modelSettings.dialogs.headers.headerValue')}
                        value={value}
                        onChange={(e) => onUpdateHeader(key, key, e.target.value)}
                        sx={(theme) => ({
                          flex: 1,
                          '& .MuiOutlinedInput-root': {
                            backgroundColor:
                              value === 'REMOVE'
                                ? alpha(theme.palette.error.main, theme.palette.mode === 'dark' ? 0.2 : 0.08)
                                : theme.palette.background.paper,
                            transition: theme.transitions.create('background-color', {
                              duration: theme.transitions.duration.shortest
                            })
                          },
                          '& .MuiOutlinedInput-input': {
                            color: value === 'REMOVE' ? theme.palette.error.main : theme.palette.text.primary
                          }
                        })}
                        helperText={value === 'REMOVE' ? t('modelSettings.dialogs.headers.willBeDisabled') : ''}
                        slotProps={{
                          formHelperText: {
                            sx: { color: 'error.main', fontSize: '0.7rem' }
                          }
                        }}
                      />
                      <IconButton
                        color="error"
                        aria-label={t('common.delete')}
                        onClick={() => onRemoveHeader(key)}
                        sx={{
                          alignSelf: { xs: 'flex-end', sm: 'center' }
                        }}
                      >
                        <Trash2 size={18} />
                      </IconButton>
                    </Box>
                  </Paper>
                ))
              ) : (
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {t('modelSettings.provider.headersConfigured', { count: 0 })}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {t('modelSettings.dialogs.headers.removeHint')}
                  </Typography>
                </Paper>
              )}
            </Stack>

            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                sx={{ alignItems: { sm: 'center' } }}
              >
                <TextField
                  size="small"
                  label={t('modelSettings.dialogs.headers.newHeaderName')}
                  placeholder={t('modelSettings.dialogs.headers.newHeaderNamePlaceholder')}
                  value={newHeaderKey}
                  onChange={(e) => onNewHeaderKeyChange(e.target.value)}
                  sx={{ flex: 1 }}
                />
                <TextField
                  size="small"
                  label={t('modelSettings.dialogs.headers.newHeaderValue')}
                  placeholder={t('modelSettings.dialogs.headers.newHeaderValuePlaceholder')}
                  value={newHeaderValue}
                  onChange={(e) => onNewHeaderValueChange(e.target.value)}
                  sx={{ flex: 1 }}
                />
                <Button
                  startIcon={<Plus size={16} />}
                  onClick={onAddHeader}
                  disabled={!newHeaderKey.trim() || !newHeaderValue.trim()}
                  variant="contained"
                  disableElevation
                  sx={{
                    borderRadius: 2,
                    width: { xs: '100%', sm: 'auto' }
                  }}
                >
                  {t('common.submit')}
                </Button>
              </Stack>
            </Paper>
          </Stack>
        )}

        {/* Body Tab */}
        {currentTab === 1 && (
          <Stack spacing={3}>
            <Typography variant="body2" color="text.secondary">
              {t('modelSettings.dialogs.body.description')}
            </Typography>

            <Stack spacing={2}>
              {hasBody ? (
                bodyEntries.map(([key, value]) => (
                  <Paper key={key} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: { xs: 'column', sm: 'row' },
                        gap: { xs: 2, sm: 1.5 },
                        alignItems: { sm: 'flex-start' }
                      }}
                    >
                      <TextField
                        size="small"
                        label={t('modelSettings.dialogs.body.parameterName')}
                        value={key}
                        onChange={(e) => onUpdateBody(key, e.target.value, value)}
                        sx={{ flex: 1 }}
                      />
                      <TextField
                        size="small"
                        label={t('modelSettings.dialogs.body.parameterValue')}
                        value={formatBodyValue(value)}
                        onChange={(e) => {
                          const parsedValue = parseBodyValue(e.target.value);
                          onUpdateBody(key, key, parsedValue);
                        }}
                        multiline
                        rows={1}
                        sx={{
                          flex: 1,
                          '& .MuiInputBase-input': {
                            fontFamily: 'monospace',
                            fontSize: '0.875rem'
                          }
                        }}
                        helperText={t('modelSettings.dialogs.body.valueHint')}
                      />
                      <IconButton
                        color="error"
                        aria-label={t('common.delete')}
                        onClick={() => onRemoveBody(key)}
                        sx={{
                          alignSelf: { xs: 'flex-end', sm: 'flex-start' },
                          mt: { sm: 0.5 }
                        }}
                      >
                        <Trash2 size={18} />
                      </IconButton>
                    </Box>
                  </Paper>
                ))
              ) : (
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {t('modelSettings.provider.bodyConfigured', { count: 0 })}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {t('modelSettings.dialogs.body.emptyHint')}
                  </Typography>
                </Paper>
              )}
            </Stack>

            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                sx={{ alignItems: { sm: 'flex-start' } }}
              >
                <TextField
                  size="small"
                  label={t('modelSettings.dialogs.body.newParameterName')}
                  placeholder={t('modelSettings.dialogs.body.newParameterNamePlaceholder')}
                  value={newBodyKey}
                  onChange={(e) => onNewBodyKeyChange(e.target.value)}
                  sx={{ flex: 1 }}
                />
                <TextField
                  size="small"
                  label={t('modelSettings.dialogs.body.newParameterValue')}
                  placeholder={t('modelSettings.dialogs.body.newParameterValuePlaceholder')}
                  value={newBodyValue}
                  onChange={(e) => onNewBodyValueChange(e.target.value)}
                  multiline
                  rows={1}
                  sx={{
                    flex: 1,
                    '& .MuiInputBase-input': {
                      fontFamily: 'monospace',
                      fontSize: '0.875rem'
                    }
                  }}
                  helperText={t('modelSettings.dialogs.body.valueHint')}
                />
                <Button
                  startIcon={<Plus size={16} />}
                  onClick={onAddBody}
                  disabled={!newBodyKey.trim() || !newBodyValue.trim()}
                  variant="contained"
                  disableElevation
                  sx={{
                    borderRadius: 2,
                    width: { xs: '100%', sm: 'auto' },
                    alignSelf: { xs: 'stretch', sm: 'flex-start' },
                    mt: { sm: 0.5 }
                  }}
                >
                  {t('common.submit')}
                </Button>
              </Stack>
            </Paper>
          </Stack>
        )}
      </DialogContent>
      
      <DialogActions sx={{ p: 2.5 }}>
        <Button onClick={onClose} color="inherit">
          {t('common.cancel')}
        </Button>
        <Button
          onClick={onClose}
          variant="contained"
          disableElevation
          sx={{ borderRadius: 2 }}
        >
          {t('common.ok')}
        </Button>
      </DialogActions>
    </BackButtonDialog>
  );
};

// ============================================================================
// 自定义请求头对话框
// ============================================================================

export const HeadersDialog: React.FC<HeadersDialogProps> = ({
  open,
  onClose,
  extraHeaders,
  newHeaderKey,
  newHeaderValue,
  onNewHeaderKeyChange,
  onNewHeaderValueChange,
  onAddHeader,
  onRemoveHeader,
  onUpdateHeader,
  onSetExtraHeaders
}) => {
  const { t } = useTranslation();
  const headersEntries = Object.entries(extraHeaders);
  const hasHeaders = headersEntries.length > 0;
  
  return (
    <BackButtonDialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle
        sx={{
          fontWeight: 600,
          color: 'text.primary',
        }}
      >
        {t('modelSettings.dialogs.headers.title')}
      </DialogTitle>
      <DialogContent dividers sx={{ pt: 3 }}>
        <Stack spacing={3}>
          <Typography variant="body2" color="text.secondary">
            {t('modelSettings.dialogs.headers.description')}
          </Typography>

          <Paper
            variant="outlined"
            sx={(theme) => ({
              p: 2,
              borderRadius: 2,
              bgcolor: theme.palette.action.hover,
              display: 'flex',
              flexDirection: 'column',
              gap: theme.spacing(1.5),
            })}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              {t('modelSettings.dialogs.headers.quickActions')}
            </Typography>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              sx={{
                flexWrap: 'wrap',
                '& > *': {
                  flex: { xs: '1 1 auto', sm: '0 0 auto' }
                }
              }}
            >
              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  onSetExtraHeaders({
                    ...extraHeaders,
                    'x-stainless-timeout': 'REMOVE'
                  });
                }}
                sx={{ borderRadius: 999 }}
              >
                {t('modelSettings.dialogs.headers.disableTimeout')}
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  onSetExtraHeaders({
                    ...extraHeaders,
                    'x-stainless-retry-count': 'REMOVE'
                  });
                }}
                sx={{ borderRadius: 999 }}
              >
                {t('modelSettings.dialogs.headers.disableRetry')}
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="error"
                onClick={() => {
                  onSetExtraHeaders({
                    ...extraHeaders,
                    'x-stainless-timeout': 'REMOVE',
                    'x-stainless-retry-count': 'REMOVE',
                    'x-stainless-arch': 'REMOVE',
                    'x-stainless-lang': 'REMOVE',
                    'x-stainless-os': 'REMOVE',
                    'x-stainless-package-version': 'REMOVE',
                    'x-stainless-runtime': 'REMOVE',
                    'x-stainless-runtime-version': 'REMOVE'
                  });
                }}
                sx={{ borderRadius: 999 }}
              >
                {t('modelSettings.dialogs.headers.disableAll')}
              </Button>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {t('modelSettings.dialogs.headers.removeHint')}
            </Typography>
          </Paper>

          <Stack spacing={2}>
            {hasHeaders ? (
              headersEntries.map(([key, value]) => (
                <Paper key={key} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: { xs: 'column', sm: 'row' },
                      gap: { xs: 2, sm: 1.5 },
                      alignItems: { sm: 'center' }
                    }}
                  >
                    <TextField
                      size="small"
                      label={t('modelSettings.dialogs.headers.headerName')}
                      value={key}
                      onChange={(e) => onUpdateHeader(key, e.target.value, value)}
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      size="small"
                      label={t('modelSettings.dialogs.headers.headerValue')}
                      value={value}
                      onChange={(e) => onUpdateHeader(key, key, e.target.value)}
                      sx={(theme) => ({
                        flex: 1,
                        '& .MuiOutlinedInput-root': {
                          backgroundColor:
                            value === 'REMOVE'
                              ? alpha(theme.palette.error.main, theme.palette.mode === 'dark' ? 0.2 : 0.08)
                              : theme.palette.background.paper,
                          transition: theme.transitions.create('background-color', {
                            duration: theme.transitions.duration.shortest
                          })
                        },
                        '& .MuiOutlinedInput-input': {
                          color: value === 'REMOVE' ? theme.palette.error.main : theme.palette.text.primary
                        }
                      })}
                      helperText={value === 'REMOVE' ? t('modelSettings.dialogs.headers.willBeDisabled') : ''}
                      slotProps={{
                        formHelperText: {
                          sx: { color: 'error.main', fontSize: '0.7rem' }
                        }
                      }}
                    />
                    <IconButton
                      color="error"
                      aria-label={t('common.delete')}
                      onClick={() => onRemoveHeader(key)}
                      sx={{
                        alignSelf: { xs: 'flex-end', sm: 'center' }
                      }}
                    >
                      <Trash2 size={18} />
                    </IconButton>
                  </Box>
                </Paper>
              ))
            ) : (
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {t('modelSettings.provider.headersConfigured', { count: 0 })}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {t('modelSettings.dialogs.headers.removeHint')}
                </Typography>
              </Paper>
            )}
          </Stack>

          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              sx={{ alignItems: { sm: 'center' } }}
            >
              <TextField
                size="small"
                label={t('modelSettings.dialogs.headers.newHeaderName')}
                placeholder={t('modelSettings.dialogs.headers.newHeaderNamePlaceholder')}
                value={newHeaderKey}
                onChange={(e) => onNewHeaderKeyChange(e.target.value)}
                sx={{ flex: 1 }}
              />
              <TextField
                size="small"
                label={t('modelSettings.dialogs.headers.newHeaderValue')}
                placeholder={t('modelSettings.dialogs.headers.newHeaderValuePlaceholder')}
                value={newHeaderValue}
                onChange={(e) => onNewHeaderValueChange(e.target.value)}
                sx={{ flex: 1 }}
              />
              <Button
                startIcon={<Plus size={16} />}
                onClick={onAddHeader}
                disabled={!newHeaderKey.trim() || !newHeaderValue.trim()}
                variant="contained"
                disableElevation
                sx={{
                  borderRadius: 2,
                  width: { xs: '100%', sm: 'auto' }
                }}
              >
                {t('common.submit')}
              </Button>
            </Stack>
          </Paper>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2.5 }}>
        <Button onClick={onClose} color="inherit">
          {t('common.cancel')}
        </Button>
        <Button
          onClick={onClose}
          variant="contained"
          disableElevation
          sx={{ borderRadius: 2 }}
        >
          {t('common.ok')}
        </Button>
      </DialogActions>
    </BackButtonDialog>
  );
};

// ============================================================================
// 自定义请求体对话框
// ============================================================================

export const CustomBodyDialog: React.FC<CustomBodyDialogProps> = ({
  open,
  onClose,
  extraBody,
  newBodyKey,
  newBodyValue,
  onNewBodyKeyChange,
  onNewBodyValueChange,
  onAddBody,
  onRemoveBody,
  onUpdateBody
}) => {
  const { t } = useTranslation();
  const bodyEntries = Object.entries(extraBody);
  const hasBody = bodyEntries.length > 0;
  
  // 尝试解析JSON值，如果失败则返回原始字符串
  const formatBodyValue = (value: any): string => {
    if (typeof value === 'string') {
      try {
        // 尝试解析JSON，如果是有效的JSON字符串则格式化
        const parsed = JSON.parse(value);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return value;
      }
    }
    return JSON.stringify(value, null, 2);
  };

  // 尝试解析输入值为JSON，如果失败则作为字符串处理
  const parseBodyValue = (value: string): any => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    
    // 尝试解析为JSON
    try {
      return JSON.parse(trimmed);
    } catch {
      // 如果不是有效的JSON，尝试解析为数字或布尔值
      if (trimmed === 'true') return true;
      if (trimmed === 'false') return false;
      if (trimmed === 'null') return null;
      if (/^-?\d+$/.test(trimmed)) return parseInt(trimmed, 10);
      if (/^-?\d*\.\d+$/.test(trimmed)) return parseFloat(trimmed);
      // 否则作为字符串返回
      return trimmed;
    }
  };
  
  return (
    <BackButtonDialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle
        sx={{
          fontWeight: 600,
          color: 'text.primary',
        }}
      >
        {t('modelSettings.dialogs.body.title')}
      </DialogTitle>
      <DialogContent dividers sx={{ pt: 3 }}>
        <Stack spacing={3}>
          <Typography variant="body2" color="text.secondary">
            {t('modelSettings.dialogs.body.description')}
          </Typography>

          <Stack spacing={2}>
            {hasBody ? (
              bodyEntries.map(([key, value]) => (
                <Paper key={key} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: { xs: 'column', sm: 'row' },
                      gap: { xs: 2, sm: 1.5 },
                      alignItems: { sm: 'flex-start' }
                    }}
                  >
                    <TextField
                      size="small"
                      label={t('modelSettings.dialogs.body.parameterName')}
                      value={key}
                      onChange={(e) => onUpdateBody(key, e.target.value, value)}
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      size="small"
                      label={t('modelSettings.dialogs.body.parameterValue')}
                      value={formatBodyValue(value)}
                      onChange={(e) => {
                        const parsedValue = parseBodyValue(e.target.value);
                        onUpdateBody(key, key, parsedValue);
                      }}
                      multiline
                      rows={1}
                      sx={{
                        flex: 1,
                        '& .MuiInputBase-input': {
                          fontFamily: 'monospace',
                          fontSize: '0.875rem'
                        }
                      }}
                      helperText={t('modelSettings.dialogs.body.valueHint')}
                    />
                    <IconButton
                      color="error"
                      aria-label={t('common.delete')}
                      onClick={() => onRemoveBody(key)}
                      sx={{
                        alignSelf: { xs: 'flex-end', sm: 'flex-start' },
                        mt: { sm: 0.5 }
                      }}
                    >
                      <Trash2 size={18} />
                    </IconButton>
                  </Box>
                </Paper>
              ))
            ) : (
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {t('modelSettings.provider.bodyConfigured', { count: 0 })}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {t('modelSettings.dialogs.body.emptyHint')}
                </Typography>
              </Paper>
            )}
          </Stack>

          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              sx={{ alignItems: { sm: 'flex-start' } }}
            >
              <TextField
                size="small"
                label={t('modelSettings.dialogs.body.newParameterName')}
                placeholder={t('modelSettings.dialogs.body.newParameterNamePlaceholder')}
                value={newBodyKey}
                onChange={(e) => onNewBodyKeyChange(e.target.value)}
                sx={{ flex: 1 }}
              />
              <TextField
                size="small"
                label={t('modelSettings.dialogs.body.newParameterValue')}
                placeholder={t('modelSettings.dialogs.body.newParameterValuePlaceholder')}
                value={newBodyValue}
                onChange={(e) => onNewBodyValueChange(e.target.value)}
                multiline
                rows={1}
                sx={{
                  flex: 1,
                  '& .MuiInputBase-input': {
                    fontFamily: 'monospace',
                    fontSize: '0.875rem'
                  }
                }}
                helperText={t('modelSettings.dialogs.body.valueHint')}
              />
              <Button
                startIcon={<Plus size={16} />}
                onClick={onAddBody}
                disabled={!newBodyKey.trim() || !newBodyValue.trim()}
                variant="contained"
                disableElevation
                sx={{
                  borderRadius: 2,
                  width: { xs: '100%', sm: 'auto' },
                  alignSelf: { xs: 'stretch', sm: 'flex-start' },
                  mt: { sm: 0.5 }
                }}
              >
                {t('common.submit')}
              </Button>
            </Stack>
          </Paper>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2.5 }}>
        <Button onClick={onClose} color="inherit">
          {t('common.cancel')}
        </Button>
        <Button
          onClick={onClose}
          variant="contained"
          disableElevation
          sx={{ borderRadius: 2 }}
        >
          {t('common.ok')}
        </Button>
      </DialogActions>
    </BackButtonDialog>
  );
};

// ============================================================================
// 自定义端点对话框
// ============================================================================

export const CustomEndpointDialog: React.FC<CustomEndpointDialogProps> = ({
  open,
  onClose,
  customEndpoint,
  customEndpointError,
  onCustomEndpointChange,
  onSave
}) => {
  const { t } = useTranslation();
  
  return (
    <BackButtonDialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{
        fontWeight: 600,
      }}>
        {t('modelSettings.dialogs.customEndpoint.title')}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('modelSettings.dialogs.customEndpoint.description')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontWeight: 500 }}>
          {t('modelSettings.dialogs.customEndpoint.example')}
        </Typography>
        <TextField
          autoFocus
          margin="dense"
          label={t('modelSettings.dialogs.customEndpoint.endpointLabel')}
          placeholder={t('modelSettings.dialogs.customEndpoint.endpointPlaceholder')}
          type="url"
          fullWidth
          variant="outlined"
          value={customEndpoint}
          onChange={(e) => onCustomEndpointChange(e.target.value)}
          error={!!customEndpointError}
          helperText={customEndpointError || t('modelSettings.dialogs.customEndpoint.helperText')}
          sx={{ mt: 2 }}
        />
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button
          onClick={onSave}
          disabled={!customEndpoint.trim()}
          sx={{
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
            color: 'primary.main',
            '&:hover': {
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.2),
            },
            borderRadius: 2,
          }}
        >
          {t('common.ok')}
        </Button>
      </DialogActions>
    </BackButtonDialog>
  );
};

// ============================================================================
// 测试结果提示条
// ============================================================================

export const TestResultSnackbar: React.FC<TestResultSnackbarProps> = ({
  open,
  testResult,
  testResultDialogOpen,
  onClose,
  onOpenDialog
}) => {
  const { t } = useTranslation();

  return (
    <Snackbar
      open={open && testResult !== null && !testResultDialogOpen}
      autoHideDuration={3000}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      sx={{ bottom: 'calc(var(--content-bottom-padding, 16px) + 8px) !important' }}
      action={
        <Button color="inherit" size="small" onClick={onOpenDialog}>
          {t('modelSettings.provider.viewDetails')}
        </Button>
      }
    >
      <Alert
        onClose={onClose}
        severity={testResult?.success ? "success" : "error"}
        variant="filled"
        sx={{ width: '100%' }}
      >
        {testResult?.success ? t('modelSettings.provider.testSuccess') : t('modelSettings.provider.testFailed')}
      </Alert>
    </Snackbar>
  );
};

// ============================================================================
// 测试结果对话框
// ============================================================================

export const TestResultDialog: React.FC<TestResultDialogProps> = ({
  open,
  onClose,
  testResult
}) => {
  const { t } = useTranslation();

  return (
    <BackButtonDialog open={open} onClose={onClose} maxWidth="md" slotProps={{ paper: { sx: { width: '100%', maxWidth: 500, borderRadius: 2 } } }}>
      <DialogTitle sx={{
        fontWeight: 600,
        color: testResult?.success ? 'success.main' : 'error.main',
        display: 'flex',
        alignItems: 'center'
      }}>
        {testResult?.success ? <CheckCircle size={20} style={{marginRight: 8}} color="#2e7d32" /> : null}
        {t('modelSettings.dialogs.testResult.title')}
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ whiteSpace: 'pre-wrap' }}>
          {testResult?.message || ''}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button
          onClick={onClose}
          variant="contained"
          color={testResult?.success ? 'success' : 'primary'}
          sx={{ borderRadius: 2 }}
        >
          {t('common.ok')}
        </Button>
      </DialogActions>
    </BackButtonDialog>
  );
};

