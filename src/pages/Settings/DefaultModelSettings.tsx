import React, { useState } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemButton,
  Avatar,
  Divider,
  AppBar,
  Toolbar,
  IconButton,
  Button,
  Paper,
  ListSubheader,
  alpha,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import { ArrowLeft as ArrowBackIcon, Plus as AddIcon, ChevronRight as ChevronRightIcon, Settings as SettingsIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../../shared/store';
import { setModelSelectorStyle, reorderProviders, updateProvider } from '../../shared/store/settingsSlice';
import type { ModelProvider } from '../../shared/config/defaultModels';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { reorderArray } from '../../shared/utils/dragUtils';
import { Bot as SmartToyIcon, AlignLeft as FormattedAlignLeftIcon, List as ViewAgendaIcon, GripVertical as DragIndicatorIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * 默认模型设置组件
 */
const DefaultModelSettings: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const providers = useAppSelector(state => state.settings.providers);
  const modelSelectorStyle = useAppSelector(state => state.settings.modelSelectorStyle);
  const [isDragging, setIsDragging] = useState(false);
  const { t } = useTranslation();

  // 编辑供应商弹窗状态
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<ModelProvider | null>(null);
  const [editProviderName, setEditProviderName] = useState('');
  const [editProviderType, setEditProviderType] = useState('');

  const handleBack = () => {
    navigate('/settings');
  };

  const handleAddProvider = () => {
    navigate('/settings/add-provider');
  };

  const handleProviderClick = (providerId: string) => {
    if (!isDragging) {
      navigate(`/settings/model-provider/${providerId}`);
    }
  };

  const toggleModelSelectorStyle = () => {
    // 切换选择器样式
    const newStyle = modelSelectorStyle === 'dialog' ? 'dropdown' : 'dialog';
    dispatch(setModelSelectorStyle(newStyle));
  };

  const handleDragEnd = (result: DropResult) => {
    setIsDragging(false);

    if (!result.destination) {
      return;
    }

    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;

    if (sourceIndex === destinationIndex) {
      return;
    }

    const reorderedProviders = reorderArray(providers, sourceIndex, destinationIndex);
    dispatch(reorderProviders(reorderedProviders));
  };

  const handleDragStart = () => {
    setIsDragging(true);
  };

  // 编辑供应商相关函数
  const handleEditProvider = (provider: ModelProvider, event: React.MouseEvent) => {
    event.stopPropagation(); // 阻止事件冒泡，避免触发provider点击
    setEditingProvider(provider);
    setEditProviderName(provider.name);
    setEditProviderType(provider.providerType || '');
    setEditDialogOpen(true);
  };

  const handleSaveProvider = () => {
    if (editingProvider && editProviderName.trim()) {
      dispatch(updateProvider({
        id: editingProvider.id,
        updates: {
          name: editProviderName.trim(),
          providerType: editProviderType
        }
      }));
      handleCloseEditDialog();
    }
  };

  const handleCloseEditDialog = () => {
    setEditDialogOpen(false);
    setEditingProvider(null);
    setEditProviderName('');
    setEditProviderType('');
  };

  // 供应商类型选项
  const providerTypeOptions = [
    { value: 'openai', label: 'OpenAI' },
    { value: 'openai-response', label: 'OpenAI (Responses API)' },
    { value: 'anthropic', label: 'Anthropic' },
    { value: 'deepseek', label: 'DeepSeek' },
    { value: 'zhipu', label: '智谱AI' },
    { value: 'google', label: 'Google' },
    { value: 'azure-openai', label: 'Azure OpenAI' },
    { value: 'siliconflow', label: 'SiliconFlow' },
    { value: 'volcengine', label: '火山引擎' },
    { value: 'grok', label: 'Grok' },
    { value: 'custom', label: '自定义' }
  ];

  return (
    <Box sx={{
      flexGrow: 1,
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      bgcolor: (theme) => theme.palette.mode === 'light'
        ? alpha(theme.palette.primary.main, 0.02)
        : alpha(theme.palette.background.default, 0.9),
    }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          bgcolor: 'background.paper',
          color: 'text.primary',
          borderBottom: 1,
          borderColor: 'divider',
          backdropFilter: 'blur(8px)',
        }}
      >
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={handleBack}
            aria-label="back"
            sx={{
              color: (theme) => theme.palette.primary.main,
            }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography
            variant="h6"
            component="div"
            sx={{
              flexGrow: 1,
              fontWeight: 600,
              backgroundImage: 'linear-gradient(90deg, #9333EA, #754AB4)',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            {t('settings.modelConfig.title')}
          </Typography>
          <Button
            startIcon={<AddIcon />}
            onClick={handleAddProvider}
            sx={{
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
              color: 'primary.main',
              '&:hover': {
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.2),
              },
              borderRadius: 2,
            }}
          >
            {t('settings.modelConfig.addProvider')}
          </Button>
        </Toolbar>
      </AppBar>

      <Box
        sx={{
          flexGrow: 1,
          overflowY: 'auto',
          p: 2,
          mt: 8,
          '&::-webkit-scrollbar': {
            width: '6px',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(0,0,0,0.1)',
            borderRadius: '3px',
          },
        }}
      >
        <Paper
          elevation={0}
          sx={{
            mb: 2,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            overflow: 'hidden',
            bgcolor: 'background.paper',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
          }}
        >
          <Box sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.01)' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {t('settings.modelConfig.providerSection.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('settings.modelConfig.providerSection.subtitle')}
            </Typography>
          </Box>

          <Divider />

          <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <Droppable droppableId="providers-list">
              {(provided) => (
                <List
                  disablePadding
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                >
                  {providers.map((provider, index) => (
                    <Draggable
                      key={provider.id}
                      draggableId={provider.id}
                      index={index}
                    >
                      {(provided, snapshot) => (
                        <ListItemButton
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          onClick={() => handleProviderClick(provider.id)}
                          sx={{
                            transition: 'all 0.2s',
                            transform: snapshot.isDragging ? 'rotate(5deg)' : 'none',
                            boxShadow: snapshot.isDragging ? '0 8px 24px rgba(0,0,0,0.15)' : 'none',
                            bgcolor: snapshot.isDragging ? 'background.paper' : 'transparent',
                            '&:hover': {
                              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.05),
                            },
                            ...provided.draggableProps.style,
                          }}
                        >
                          <Box
                            {...provided.dragHandleProps}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              mr: 1,
                              cursor: 'grab',
                              '&:active': {
                                cursor: 'grabbing',
                              },
                              opacity: 0.6,
                              '&:hover': {
                                opacity: 1,
                              }
                            }}
                          >
                            <DragIndicatorIcon fontSize="small" />
                          </Box>
                          <ListItemAvatar>
                            <Avatar
                              sx={{
                                bgcolor: provider.color || '#8e24aa',
                                boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
                              }}
                            >
                              {provider.avatar || provider.name.charAt(0).toUpperCase()}
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={
                              <Typography sx={{ fontWeight: 600, color: 'text.primary' }}>
                                {provider.name}
                              </Typography>
                            }
                            secondary={
                              <Box component="span" sx={{ display: 'flex', alignItems: 'center' }}>
                                <Typography
                                  component="span"
                                  variant="body2"
                                  sx={{
                                    mr: 1,
                                    color: provider.isEnabled ? 'success.main' : 'text.disabled',
                                    fontWeight: 500
                                  }}
                                >
                                  {provider.isEnabled ? t('settings.modelConfig.providerStatus.enabled') : t('settings.modelConfig.providerStatus.disabled')}
                                </Typography>
                                {provider.models.length > 0 && (
                                  <Typography component="span" variant="body2" color="text.secondary">
                                    {t('settings.modelConfig.providerStatus.modelsCount', { count: provider.models.length })}
                                  </Typography>
                                )}
                              </Box>
                            }
                          />
                          <IconButton
                            size="small"
                            onClick={(e) => handleEditProvider(provider, e)}
                            sx={{
                              mr: 1,
                              color: 'text.secondary',
                              '&:hover': {
                                color: 'primary.main',
                                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                              },
                            }}
                          >
                            <SettingsIcon size={16} />
                          </IconButton>
                          <ChevronRightIcon size={20} style={{ color: 'rgba(79, 70, 229, 0.5)' }} />
                        </ListItemButton>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </List>
              )}
            </Droppable>
          </DragDropContext>
        </Paper>

        <Paper
          elevation={0}
          sx={{
            mb: 2,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            overflow: 'hidden',
            bgcolor: 'background.paper',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
          }}
        >
          <List
            subheader={
              <ListSubheader
                component="div"
                sx={{
                  bgcolor: 'rgba(0,0,0,0.01)',
                  py: 1,
                  fontWeight: 600,
                  color: 'text.primary'
                }}
              >
                {t('settings.modelConfig.recommendations.title')}
              </ListSubheader>
            }
          >
            <ListItem disablePadding>
              <ListItemButton
                onClick={() => navigate('/settings/topic-naming-settings')}
                sx={{
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.05),
                  }
                }}
              >
                <ListItemAvatar>
                  <Avatar sx={{
                    bgcolor: alpha('#4f46e5', 0.12),
                    color: '#4f46e5',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
                  }}>
                    <SmartToyIcon />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={<Typography sx={{ fontWeight: 600, color: 'text.primary' }}>{t('settings.modelConfig.recommendations.topicNaming.primary')}</Typography>}
                  secondary={t('settings.modelConfig.recommendations.topicNaming.secondary')}
                />
                <ChevronRightIcon size={20} style={{ color: 'var(--mui-palette-text-secondary)' }} />
              </ListItemButton>
            </ListItem>

            <Divider variant="inset" component="li" sx={{ ml: 0 }} />

            <ListItem disablePadding>
              <ListItemButton
                onClick={toggleModelSelectorStyle}
                sx={{
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.05),
                  }
                }}
              >
                <ListItemAvatar>
                  <Avatar sx={{
                    bgcolor: alpha('#06b6d4', 0.12),
                    color: '#06b6d4',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
                  }}>
                    {modelSelectorStyle === 'dialog' ? <ViewAgendaIcon /> : <FormattedAlignLeftIcon />}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={<Typography sx={{ fontWeight: 600, color: 'text.primary' }}>{t('settings.modelConfig.recommendations.selectorStyle.primary')}</Typography>}
                  secondary={t(modelSelectorStyle === 'dialog' ? 'settings.modelConfig.recommendations.selectorStyle.dialog' : 'settings.modelConfig.recommendations.selectorStyle.dropdown')}
                />
              </ListItemButton>
            </ListItem>

            <Divider variant="inset" component="li" sx={{ ml: 0 }} />

            <ListItem disablePadding>
              <ListItemButton
                onClick={() => navigate('/settings/add-provider')}
                sx={{
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.05),
                  }
                }}
              >
                <ListItemAvatar>
                  <Avatar sx={{
                    bgcolor: alpha('#9333ea', 0.12),
                    color: '#9333ea',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
                  }}>
                    <AddIcon />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={<Typography sx={{ fontWeight: 600, color: 'text.primary' }}>{t('settings.modelConfig.recommendations.addNewProvider.primary')}</Typography>}
                  secondary={t('settings.modelConfig.recommendations.addNewProvider.secondary')}
                />
                <ChevronRightIcon size={20} style={{ color: 'var(--mui-palette-text-secondary)' }} />
              </ListItemButton>
            </ListItem>
          </List>
        </Paper>
      </Box>

      {/* 编辑供应商弹窗 */}
      <Dialog
        open={editDialogOpen}
        onClose={handleCloseEditDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
          }
        }}
      >
        <DialogTitle sx={{
          fontWeight: 600,
          backgroundImage: 'linear-gradient(90deg, #9333EA, #754AB4)',
          backgroundClip: 'text',
          color: 'transparent',
        }}>
          {t('settings.modelConfig.editDialog.title')}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            autoFocus
            margin="dense"
            label={t('settings.modelConfig.editDialog.nameLabel')}
            placeholder="例如: 我的智谱AI"
            type="text"
            fullWidth
            variant="outlined"
            value={editProviderName}
            onChange={(e) => setEditProviderName(e.target.value)}
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth variant="outlined">
            <InputLabel id="provider-type-label">{t('settings.modelConfig.editDialog.typeLabel')}</InputLabel>
            <Select
              value={editProviderType}
              onChange={(e) => setEditProviderType(e.target.value)}
              label="供应商类型"
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
          <Button onClick={handleCloseEditDialog}>{t('settings.modelConfig.editDialog.cancel')}</Button>
          <Button
            onClick={handleSaveProvider}
            disabled={!editProviderName.trim()}
            sx={{
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
              color: 'primary.main',
              '&:hover': {
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.2),
              },
              borderRadius: 2,
            }}
          >
            {t('settings.modelConfig.editDialog.save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DefaultModelSettings;