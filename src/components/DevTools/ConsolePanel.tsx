import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  Box,
  List,
  ListItem,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  Collapse,
  Paper,
  alpha,
  Tooltip,
  Checkbox,
  MenuItem,
} from '@mui/material';
import {
  Search as SearchIcon,
  Play as PlayArrowIcon,
  AlertCircle as ErrorIcon,
  AlertTriangle as WarningIcon,
  Info as InfoIcon,
  Bug as BugReportIcon,
  Terminal as TerminalIcon,
  X as ClearIcon,
} from 'lucide-react';
import { useTheme } from '@mui/material/styles';
import { useTranslation } from '../../i18n';
import { logViewerService } from '../../shared/services/infra/logger/logViewer';
import type { LogViewerEntry, LogViewerFilter, LogLevelName } from '../../shared/services/infra/logger/logViewer';

const ALL_LEVELS: LogLevelName[] = ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'];

interface ConsolePanelProps {
  autoScroll?: boolean;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
}

export interface ConsolePanelRef {
  getFilteredEntries: () => LogViewerEntry[];
}

const ConsolePanel = forwardRef<ConsolePanelRef, ConsolePanelProps>(({ 
  autoScroll = true,
  selectionMode = false,
  selectedIds = new Set(),
  onSelectionChange,
}, ref) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [entries, setEntries] = useState<LogViewerEntry[]>([]);
  const [filter, setFilter] = useState<LogViewerFilter>({
    levels: new Set<LogLevelName>(ALL_LEVELS),
    context: null,
    searchText: '',
    showTimestamps: true
  });
  const [command, setCommand] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const consoleEndRef = useRef<HTMLDivElement>(null);
  const consoleService = logViewerService;

  useEffect(() => {
    const unsubscribe = consoleService.addListener(() => {
      setEntries(consoleService.getEntries());
    });

    setEntries(consoleService.getEntries());
    return unsubscribe;
  }, [consoleService]);

  useEffect(() => {
    if (autoScroll && consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [entries, autoScroll]);

  const executeCommand = () => {
    if (!command.trim()) return;

    const newHistory = [...commandHistory, command];
    setCommandHistory(newHistory);
    setHistoryIndex(-1);

    consoleService.executeCommand(command);
    setCommand('');
  };

  const handleCommandKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      executeCommand();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setCommand(commandHistory[commandHistory.length - 1 - newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setCommand(commandHistory[commandHistory.length - 1 - newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCommand('');
      }
    }
  };

  const getConsoleColor = (level: LogLevelName) => {
    switch (level) {
      case 'ERROR':
        return theme.palette.error.main;
      case 'WARN':
        return theme.palette.warning.main;
      case 'INFO':
        return theme.palette.info.main;
      case 'DEBUG':
        return theme.palette.success.main;
      default:
        return theme.palette.text.primary;
    }
  };

  const getConsoleIcon = (level: LogLevelName) => {
    switch (level) {
      case 'ERROR':
        return <ErrorIcon size={16} />;
      case 'WARN':
        return <WarningIcon size={16} />;
      case 'INFO':
        return <InfoIcon size={16} />;
      case 'DEBUG':
        return <BugReportIcon size={16} />;
      default:
        return <TerminalIcon size={16} />;
    }
  };

  const contexts = consoleService.getContexts();

  const filteredEntries = consoleService.getFilteredEntries(filter);

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    getFilteredEntries: () => filteredEntries,
  }), [filteredEntries]);

  // 切换选中状态
  const handleToggleSelect = (id: string) => {
    if (!onSelectionChange) return;
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    onSelectionChange(newSelected);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: 'transparent' }}>
      {/* 过滤器 - 优化设计 */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderBottom: `1px solid ${theme.palette.divider}`,
          bgcolor: theme.palette.mode === 'dark'
            ? alpha(theme.palette.background.paper, 0.4)
            : theme.palette.background.paper,
          borderRadius: 0,
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            size="small"
            placeholder={t('devtools.console.searchPlaceholder')}
            value={filter.searchText}
            onChange={(e) => setFilter(prev => ({ ...prev, searchText: e.target.value }))}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon size={18} style={{ color: theme.palette.text.secondary }} />
                </InputAdornment>
              ),
              endAdornment: filter.searchText && (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={() => setFilter(prev => ({ ...prev, searchText: '' }))}
                    sx={{ p: 0.5 }}
                  >
                    <ClearIcon size={14} />
                  </IconButton>
                </InputAdornment>
              ),
            }}
            fullWidth
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.05) : alpha(theme.palette.common.black, 0.02),
                '&:hover': {
                  bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.08) : alpha(theme.palette.common.black, 0.04),
                },
                '&.Mui-focused': {
                  bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.08) : alpha(theme.palette.common.black, 0.04),
                },
              },
            }}
          />
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5, fontWeight: 500 }}>
              {t('devtools.console.level')}
            </Typography>
            {ALL_LEVELS.map(level => (
              <Chip
                key={level}
                label={level}
                size="small"
                variant={filter.levels.has(level) ? "filled" : "outlined"}
                color={level === 'ERROR' ? 'error' : level === 'WARN' ? 'warning' : 'default'}
                onClick={() => {
                  const newLevels = new Set(filter.levels);
                  if (newLevels.has(level)) {
                    newLevels.delete(level);
                  } else {
                    newLevels.add(level);
                  }
                  setFilter(prev => ({ ...prev, levels: newLevels }));
                }}
                sx={{
                  fontWeight: filter.levels.has(level) ? 600 : 400,
                  transition: 'all 0.2s',
                  '&:hover': {
                    transform: 'translateY(-1px)',
                    boxShadow: theme.shadows[2],
                  },
                }}
              />
            ))}
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5, fontWeight: 500 }}>
              {t('devtools.console.module')}
            </Typography>
            <TextField
              select
              size="small"
              value={filter.context ?? '__all__'}
              onChange={(e) =>
                setFilter(prev => ({
                  ...prev,
                  context: e.target.value === '__all__' ? null : e.target.value,
                }))
              }
              sx={{ minWidth: 160 }}
            >
              <MenuItem value="__all__">{t('devtools.console.allModules')}</MenuItem>
              {contexts.map(ctx => (
                <MenuItem key={ctx} value={ctx}>{ctx}</MenuItem>
              ))}
            </TextField>
          </Box>
        </Box>
      </Paper>

      {/* 控制台输出 - 优化设计 */}
      <Box 
        sx={{ 
          flexGrow: 1, 
          overflow: 'auto',
          bgcolor: theme.palette.mode === 'dark' 
            ? alpha(theme.palette.background.default, 0.5)
            : theme.palette.background.default,
          position: 'relative',
        }}
      >
        <List 
          dense 
          sx={{ 
            p: 0, 
            fontFamily: 'monospace',
            fontSize: '0.8125rem',
          }}
        >
          {filteredEntries.length === 0 ? (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                py: 8,
                color: 'text.secondary',
              }}
            >
              <TerminalIcon size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
              <Typography variant="body2" color="text.secondary">
                {filter.searchText ? t('devtools.console.noResults') : t('devtools.console.empty')}
              </Typography>
            </Box>
          ) : (
            filteredEntries.map((entry, index) => {
              const hasLongContent =
                entry.message.length > 200 ||
                entry.message.split('\n').length > 5 ||
                entry.args.some(arg => {
                  const formatted = consoleService.formatArg(arg);
                  return formatted.length > 200 || formatted.split('\n').length > 5;
                });
              const isSelected = selectedIds.has(entry.id);
              
              return (
                <ListItem
                  key={entry.id}
                  onClick={selectionMode ? () => handleToggleSelect(entry.id) : undefined}
                  sx={{
                    py: 1.5,
                    px: 2,
                    borderBottom: index < filteredEntries.length - 1 ? `1px solid ${alpha(theme.palette.divider, 0.5)}` : 'none',
                    bgcolor: isSelected 
                      ? alpha(theme.palette.primary.main, 0.08) 
                      : 'transparent',
                    '&:hover': { 
                      bgcolor: isSelected
                        ? alpha(theme.palette.primary.main, 0.12)
                        : theme.palette.mode === 'dark'
                          ? alpha(theme.palette.common.white, 0.05)
                          : alpha(theme.palette.common.black, 0.02),
                    },
                    alignItems: 'flex-start',
                    transition: 'background-color 0.2s',
                    cursor: selectionMode ? 'pointer' : 'default',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', width: '100%', gap: 1.5 }}>
                    {selectionMode && (
                      <Checkbox
                        checked={isSelected}
                        onChange={() => handleToggleSelect(entry.id)}
                        onClick={(e) => e.stopPropagation()}
                        size="small"
                        sx={{ 
                          p: 0, 
                          mt: 0.25,
                          '&.Mui-checked': {
                            color: 'primary.main',
                          },
                        }}
                      />
                    )}
                    <Box 
                      sx={{ 
                        color: getConsoleColor(entry.level), 
                        mt: 0.25,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 20,
                        height: 20,
                        flexShrink: 0,
                      }}
                    >
                      {getConsoleIcon(entry.level)}
                    </Box>
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        {filter.showTimestamps && (
                          <Typography 
                            variant="caption" 
                            sx={{ 
                              color: 'text.secondary',
                              fontSize: '0.75rem',
                              fontFamily: 'monospace',
                            }}
                          >
                            {new Date(entry.timestamp).toLocaleTimeString()}
                          </Typography>
                        )}
                        <Chip
                          label={entry.level}
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: '0.65rem',
                            fontWeight: 600,
                            bgcolor: alpha(getConsoleColor(entry.level), 0.15),
                            color: getConsoleColor(entry.level),
                            border: `1px solid ${alpha(getConsoleColor(entry.level), 0.3)}`,
                          }}
                        />
                        {entry.context && (
                          <Chip
                            label={entry.context}
                            size="small"
                            variant="outlined"
                            sx={{
                              height: 18,
                              fontSize: '0.65rem',
                              fontWeight: 500,
                              color: 'text.secondary',
                              borderColor: alpha(theme.palette.text.secondary, 0.3),
                            }}
                          />
                        )}
                      </Box>
                      <Box
                        sx={{
                          wordBreak: 'break-word',
                          whiteSpace: 'pre-wrap',
                          maxHeight: hasLongContent ? '300px' : 'none',
                          overflow: hasLongContent ? 'auto' : 'visible',
                          border: hasLongContent ? `1px solid ${alpha(theme.palette.divider, 0.5)}` : 'none',
                          borderRadius: hasLongContent ? '6px' : 0,
                          padding: hasLongContent ? '10px' : '0',
                          backgroundColor: hasLongContent
                            ? (theme.palette.mode === 'dark' 
                                ? alpha(theme.palette.common.white, 0.03)
                                : alpha(theme.palette.common.black, 0.015))
                            : 'transparent',
                          '&::-webkit-scrollbar': {
                            width: '8px',
                            height: '8px',
                          },
                          '&::-webkit-scrollbar-thumb': {
                            backgroundColor: alpha(theme.palette.text.secondary, 0.3),
                            borderRadius: '4px',
                            '&:hover': {
                              backgroundColor: alpha(theme.palette.text.secondary, 0.5),
                            }
                          },
                          '&::-webkit-scrollbar-track': {
                            backgroundColor: 'transparent',
                          },
                        }}
                      >
                        {entry.message && (
                          <span
                            style={{
                              marginRight: '8px',
                              color: theme.palette.text.primary,
                            }}
                          >
                            {entry.message}
                          </span>
                        )}
                        {entry.args.map((arg, argIndex) => (
                          <span 
                            key={argIndex} 
                            style={{ 
                              marginRight: '8px',
                              color: theme.palette.text.primary,
                            }}
                          >
                            {consoleService.formatArg(arg)}
                          </span>
                        ))}
                      </Box>
                      {entry.stack && (
                        <Collapse in={true}>
                          <Typography
                            variant="caption"
                            component="pre"
                            sx={{
                              color: theme.palette.error.main,
                              fontSize: '0.75rem',
                              mt: 1,
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              maxHeight: '200px',
                              overflow: 'auto',
                              border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`,
                              borderRadius: '6px',
                              padding: '10px',
                              backgroundColor: alpha(theme.palette.error.main, 0.05),
                              fontFamily: 'monospace',
                              '&::-webkit-scrollbar': {
                                width: '8px',
                                height: '8px',
                              },
                              '&::-webkit-scrollbar-thumb': {
                                backgroundColor: alpha(theme.palette.text.secondary, 0.3),
                                borderRadius: '4px',
                                '&:hover': {
                                  backgroundColor: alpha(theme.palette.text.secondary, 0.5),
                                }
                              },
                              '&::-webkit-scrollbar-track': {
                                backgroundColor: 'transparent',
                              },
                            }}
                          >
                            {entry.stack}
                          </Typography>
                        </Collapse>
                      )}
                    </Box>
                  </Box>
                </ListItem>
              );
            })
          )}
          <div ref={consoleEndRef} />
        </List>
      </Box>

      {/* 命令输入 - 优化设计 */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderTop: `1px solid ${theme.palette.divider}`,
          bgcolor: theme.palette.mode === 'dark'
            ? alpha(theme.palette.background.paper, 0.4)
            : theme.palette.background.paper,
          borderRadius: 0,
        }}
      >
        <TextField
          size="small"
          placeholder={t('devtools.console.commandPlaceholder')}
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={handleCommandKeyDown}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: 'primary.main',
                    fontWeight: 600,
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                  }}
                >
                  &gt;
                </Typography>
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <Tooltip title={t('devtools.console.executeTooltip')}>
                  <span>
                    <IconButton 
                      size="small" 
                      onClick={executeCommand} 
                      disabled={!command.trim()}
                      sx={{
                        color: command.trim() ? 'primary.main' : 'action.disabled',
                        '&:hover': {
                          bgcolor: alpha(theme.palette.primary.main, 0.08),
                        },
                      }}
                    >
                      <PlayArrowIcon size={18} />
                    </IconButton>
                  </span>
                </Tooltip>
              </InputAdornment>
            ),
          }}
          fullWidth
          sx={{
            fontFamily: 'monospace',
            fontSize: '0.875rem',
            '& .MuiOutlinedInput-root': {
              bgcolor: theme.palette.mode === 'dark' 
                ? alpha(theme.palette.common.white, 0.05)
                : alpha(theme.palette.common.black, 0.02),
              '&:hover': {
                bgcolor: theme.palette.mode === 'dark' 
                  ? alpha(theme.palette.common.white, 0.08)
                  : alpha(theme.palette.common.black, 0.04),
              },
              '&.Mui-focused': {
                bgcolor: theme.palette.mode === 'dark' 
                  ? alpha(theme.palette.common.white, 0.08)
                  : alpha(theme.palette.common.black, 0.04),
                borderColor: 'primary.main',
              },
            },
          }}
        />
      </Paper>
    </Box>
  );
});

ConsolePanel.displayName = 'ConsolePanel';

export default ConsolePanel;
