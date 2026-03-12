import React from 'react';
import {
  Box,
  Button,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import { Terminal as TerminalIcon } from 'lucide-react';
import BackButtonDialog from '../../../components/common/BackButtonDialog';
import type { MCPServer, MCPServerType } from '../../../shared/types';
import { useTranslation } from '../../../i18n';

interface AddServerDialogProps {
  open: boolean;
  onClose: () => void;
  newServer: Partial<MCPServer>;
  onNewServerChange: (server: Partial<MCPServer>) => void;
  onAdd: () => void;
  isTauriDesktop: boolean;
}

const AddServerDialog: React.FC<AddServerDialogProps> = ({
  open,
  onClose,
  newServer,
  onNewServerChange,
  onAdd,
  isTauriDesktop
}) => {
  const { t } = useTranslation();

  return (
    <BackButtonDialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('settings.mcpServer.addDialog.title')}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label={t('settings.mcpServer.addDialog.serverName')}
          fullWidth
          variant="outlined"
          value={newServer.name}
          onChange={(e) => onNewServerChange({ ...newServer, name: e.target.value })}
          sx={{ mb: 2 }}
        />
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>{t('settings.mcpServer.addDialog.serverType')}</InputLabel>
          <Select
            value={newServer.type}
            label={t('settings.mcpServer.addDialog.serverType')}
            onChange={(e) => onNewServerChange({ ...newServer, type: e.target.value as MCPServerType })}
          >
            <MenuItem value="sse">{t('settings.mcpServer.addDialog.types.sse')}</MenuItem>
            <MenuItem value="streamableHttp">{t('settings.mcpServer.addDialog.types.streamableHttp')}</MenuItem>
            <MenuItem value="inMemory">{t('settings.mcpServer.addDialog.types.inMemory')}</MenuItem>
            {isTauriDesktop && (
              <MenuItem value="stdio">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TerminalIcon size={16} />
                  {t('settings.mcpServer.addDialog.types.stdio') || '标准输入/输出 (stdio)'}
                </Box>
              </MenuItem>
            )}
          </Select>
        </FormControl>
        {(newServer.type === 'sse' || newServer.type === 'streamableHttp' || newServer.type === 'httpStream') && (
          <TextField
            margin="dense"
            label={t('settings.mcpServer.addDialog.serverUrl')}
            fullWidth
            variant="outlined"
            value={newServer.baseUrl}
            onChange={(e) => onNewServerChange({ ...newServer, baseUrl: e.target.value })}
            placeholder={t('settings.mcpServer.addDialog.placeholders.url')}
            sx={{ mb: 2 }}
          />
        )}
        {newServer.type === 'stdio' && (
          <>
            <TextField
              margin="dense"
              label={t('settings.mcpServer.addDialog.command') || '命令'}
              fullWidth
              variant="outlined"
              value={newServer.command}
              onChange={(e) => onNewServerChange({ ...newServer, command: e.target.value })}
              placeholder="npx, node, python, uvx..."
              helperText={t('settings.mcpServer.addDialog.commandHelp') || '要执行的命令程序，如 npx、node、python 等'}
              sx={{ mb: 2 }}
            />
            <TextField
              margin="dense"
              label={t('settings.mcpServer.addDialog.args') || '命令参数'}
              fullWidth
              variant="outlined"
              value={newServer.argsText ?? (newServer.args || []).join(' ')}
              onChange={(e) => onNewServerChange({ ...newServer, argsText: e.target.value })}
              placeholder="-y @anthropic/mcp-server-fetch"
              helperText={t('settings.mcpServer.addDialog.argsHelp') || '命令参数，用空格分隔'}
              sx={{ mb: 2 }}
            />
          </>
        )}
        <TextField
          margin="dense"
          label={t('settings.mcpServer.addDialog.description')}
          fullWidth
          variant="outlined"
          multiline
          rows={2}
          value={newServer.description}
          onChange={(e) => onNewServerChange({ ...newServer, description: e.target.value })}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('settings.mcpServer.addDialog.cancel')}</Button>
        <Button onClick={onAdd} variant="contained">{t('settings.mcpServer.addDialog.add')}</Button>
      </DialogActions>
    </BackButtonDialog>
  );
};

export default AddServerDialog;
