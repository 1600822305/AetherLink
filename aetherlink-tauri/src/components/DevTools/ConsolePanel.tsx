import React, { useState, useEffect, useRef } from 'react';
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
} from '@mui/material';
import {
  Search as SearchIcon,
  Play as PlayArrowIcon,
  AlertCircle as ErrorIcon,
  AlertTriangle as WarningIcon,
  Info as InfoIcon,
  Bug as BugReportIcon,
  Terminal as TerminalIcon,
} from 'lucide-react';
import { useTheme } from '@mui/material/styles';
import EnhancedConsoleService from '../../shared/services/EnhancedConsoleService';
import type { ConsoleEntry, ConsoleLevel, ConsoleFilter } from '../../shared/services/EnhancedConsoleService';

interface ConsolePanelProps {
  autoScroll?: boolean;
}

const ConsolePanel: React.FC<ConsolePanelProps> = ({ autoScroll = true }) => {
  const theme = useTheme();
  const [entries, setEntries] = useState<ConsoleEntry[]>([]);
  const [filter, setFilter] = useState<ConsoleFilter>({
    levels: new Set(['log', 'info', 'warn', 'error', 'debug']),
    searchText: '',
    showTimestamps: true
  });
  const [command, setCommand] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const consoleEndRef = useRef<HTMLDivElement>(null);
  const consoleService = EnhancedConsoleService.getInstance();

  useEffect(() => {
    const unsubscribe = consoleService.addListener((newEntries) => {
      setEntries(newEntries);
    });

    setEntries(consoleService.getEntries());
    return unsubscribe;
  }, []);

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

  const getConsoleColor = (level: ConsoleLevel) => {
    switch (level) {
      case 'error':
        return theme.palette.error.main;
      case 'warn':
        return theme.palette.warning.main;
      case 'info':
        return theme.palette.info.main;
      case 'debug':
        return theme.palette.success.main;
      default:
        return theme.palette.text.primary;
    }
  };

  const getConsoleIcon = (level: ConsoleLevel) => {
    switch (level) {
      case 'error':
        return <ErrorIcon size={16} />;
      case 'warn':
        return <WarningIcon size={16} />;
      case 'info':
        return <InfoIcon size={16} />;
      case 'debug':
        return <BugReportIcon size={16} />;
      default:
        return <TerminalIcon size={16} />;
    }
  };

  const filteredEntries = consoleService.getFilteredEntries(filter);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 过滤器 */}
      <Box sx={{ p: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <TextField
            size="small"
            placeholder="过滤控制台输出..."
            value={filter.searchText}
            onChange={(e) => setFilter(prev => ({ ...prev, searchText: e.target.value }))}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon size={16} />
                </InputAdornment>
              ),
            }}
            fullWidth
          />
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {(['error', 'warn', 'info', 'log', 'debug'] as ConsoleLevel[]).map(level => (
              <Chip
                key={level}
                label={level.toUpperCase()}
                size="small"
                variant={filter.levels.has(level) ? "filled" : "outlined"}
                color={level === 'error' ? 'error' : level === 'warn' ? 'warning' : 'default'}
                onClick={() => {
                  const newLevels = new Set(filter.levels);
                  if (newLevels.has(level)) {
                    newLevels.delete(level);
                  } else {
                    newLevels.add(level);
                  }
                  setFilter(prev => ({ ...prev, levels: newLevels }));
                }}
              />
            ))}
          </Box>
        </Box>
      </Box>

      {/* 控制台输出 */}
      <Box sx={{ flexGrow: 1, overflow: 'auto', bgcolor: theme.palette.mode === 'dark' ? '#1e1e1e' : '#fafafa' }}>
        <List dense sx={{ p: 0, fontFamily: 'monospace' }}>
          {filteredEntries.map((entry) => (
            <ListItem
              key={entry.id}
              sx={{
                py: 0.25,
                px: 1,
                borderBottom: '1px solid',
                borderColor: 'divider',
                '&:hover': { bgcolor: 'action.hover' },
                alignItems: 'flex-start'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start', width: '100%', gap: 1 }}>
                <Box sx={{ color: getConsoleColor(entry.level), mt: 0.5 }}>
                  {getConsoleIcon(entry.level)}
                </Box>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  {filter.showTimestamps && (
                    <Typography variant="caption" sx={{ color: 'text.secondary', mr: 1 }}>
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </Typography>
                  )}
                  <Box
                    sx={{
                      wordBreak: 'break-word',
                      whiteSpace: 'pre-wrap',
                      maxHeight: '300px',
                      overflow: 'auto',
                      border: entry.args.some(arg => {
                        const formatted = consoleService.formatArg(arg);
                        return formatted.length > 200 || formatted.split('\n').length > 5;
                      }) ? '1px solid' : 'none',
                      borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                      borderRadius: '4px',
                      padding: entry.args.some(arg => {
                        const formatted = consoleService.formatArg(arg);
                        return formatted.length > 200 || formatted.split('\n').length > 5;
                      }) ? '8px' : '0',
                      backgroundColor: entry.args.some(arg => {
                        const formatted = consoleService.formatArg(arg);
                        return formatted.length > 200 || formatted.split('\n').length > 5;
                      }) ? (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)') : 'transparent',
                      '&::-webkit-scrollbar': {
                        width: '6px',
                        height: '6px',
                      },
                      '&::-webkit-scrollbar-thumb': {
                        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
                        borderRadius: '3px',
                        '&:hover': {
                          backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
                        }
                      },
                      '&::-webkit-scrollbar-track': {
                        backgroundColor: 'transparent',
                      },
                      '&::-webkit-scrollbar-corner': {
                        backgroundColor: 'transparent',
                      },
                    }}
                  >
                    {entry.args.map((arg, argIndex) => (
                      <span key={argIndex} style={{ marginRight: '8px' }}>
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
                          color: 'text.secondary',
                          fontSize: '0.75rem',
                          mt: 0.5,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          maxHeight: '200px',
                          overflow: 'auto',
                          border: '1px solid',
                          borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                          borderRadius: '4px',
                          padding: '8px',
                          backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                          '&::-webkit-scrollbar': {
                            width: '6px',
                            height: '6px',
                          },
                          '&::-webkit-scrollbar-thumb': {
                            backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
                            borderRadius: '3px',
                            '&:hover': {
                              backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
                            }
                          },
                          '&::-webkit-scrollbar-track': {
                            backgroundColor: 'transparent',
                          },
                          '&::-webkit-scrollbar-corner': {
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
          ))}
          <div ref={consoleEndRef} />
        </List>
      </Box>

      {/* 命令输入 */}
      <Box sx={{ p: 1, borderTop: 1, borderColor: 'divider' }}>
        <TextField
          size="small"
          placeholder="输入 JavaScript 命令..."
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={handleCommandKeyDown}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Typography variant="body2" sx={{ color: 'primary.main' }}>
                  &gt;
                </Typography>
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton size="small" onClick={executeCommand} disabled={!command.trim()}>
                  <PlayArrowIcon size={16} />
                </IconButton>
              </InputAdornment>
            ),
          }}
          fullWidth
          sx={{ fontFamily: 'monospace' }}
        />
      </Box>
    </Box>
  );
};

export default ConsolePanel;