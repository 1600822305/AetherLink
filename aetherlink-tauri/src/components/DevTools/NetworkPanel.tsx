import React, { useState, useEffect } from 'react';
import {
  Box,
  List,
  ListItem,
  Typography,
  TextField,
  InputAdornment,
  FormControlLabel,
  Switch,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Search as SearchIcon,
  Globe as HttpIcon,
  X as ClearIcon,
  ChevronDown as ExpandMoreIcon,
} from 'lucide-react';
import { useTheme } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';
import EnhancedNetworkService from '../../shared/services/network/EnhancedNetworkService';
import type { NetworkEntry, NetworkFilter } from '../../shared/services/network/EnhancedNetworkService';

const NetworkPanel: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [, setEntries] = useState<NetworkEntry[]>([]);
  const [filter, setFilter] = useState<NetworkFilter>({
    methods: new Set(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']),
    statuses: new Set(['pending', 'success', 'error', 'cancelled']),
    searchText: '',
    hideDataUrls: true,
    onlyErrors: false
  });
  const [selectedEntry, setSelectedEntry] = useState<NetworkEntry | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const networkService = EnhancedNetworkService.getInstance();

  useEffect(() => {
    const unsubscribe = networkService.addListener((newEntries) => {
      setEntries(newEntries);
    });

    setEntries(networkService.getEntries());
    return unsubscribe;
  }, []);

  const filteredEntries = networkService.getFilteredEntries(filter);

  const handleEntryClick = (entry: NetworkEntry) => {
    setSelectedEntry(entry);
    setShowDetails(true);
  };

  const renderDetailsDialog = () => (
    <Dialog
      open={showDetails}
      onClose={() => setShowDetails(false)}
      maxWidth="md"
      fullWidth
      fullScreen={isMobile}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <HttpIcon size={20} />
          网络请求详情
          <IconButton
            size="small"
            onClick={() => setShowDetails(false)}
            sx={{ ml: 'auto' }}
          >
            <ClearIcon size={16} />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        {selectedEntry && (
          <Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 2 }}>
              <Box>
                <Typography variant="subtitle2">请求URL:</Typography>
                <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                  {selectedEntry.url}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Box>
                  <Typography variant="subtitle2">请求方法:</Typography>
                  <Chip
                    label={selectedEntry.method}
                    size="small"
                    sx={{ bgcolor: networkService.getMethodColor(selectedEntry.method), color: 'white' }}
                  />
                </Box>
                <Box>
                  <Typography variant="subtitle2">状态:</Typography>
                  <Chip
                    label={selectedEntry.statusCode || selectedEntry.status}
                    size="small"
                    color={selectedEntry.status === 'success' ? 'success' : selectedEntry.status === 'error' ? 'error' : 'default'}
                  />
                </Box>
                {selectedEntry.duration && (
                  <Box>
                    <Typography variant="subtitle2">耗时:</Typography>
                    <Typography variant="body2">
                      {networkService.formatDuration(selectedEntry.duration)}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon size={16} />}>
                <Typography>请求头</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <pre style={{ fontSize: '0.875rem', margin: 0, whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(selectedEntry.requestHeaders, null, 2)}
                </pre>
              </AccordionDetails>
            </Accordion>

            {selectedEntry.requestPayload && (
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon size={16} />}>
                  <Typography>请求体</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <pre style={{ fontSize: '0.875rem', margin: 0, whiteSpace: 'pre-wrap' }}>
                    {typeof selectedEntry.requestPayload === 'string'
                      ? selectedEntry.requestPayload
                      : JSON.stringify(selectedEntry.requestPayload, null, 2)}
                  </pre>
                </AccordionDetails>
              </Accordion>
            )}

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon size={16} />}>
                <Typography>响应头</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <pre style={{ fontSize: '0.875rem', margin: 0, whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(selectedEntry.responseHeaders, null, 2)}
                </pre>
              </AccordionDetails>
            </Accordion>

            {selectedEntry.responseData && (
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon size={16} />}>
                  <Typography>响应体</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <pre style={{ fontSize: '0.875rem', margin: 0, whiteSpace: 'pre-wrap' }}>
                    {typeof selectedEntry.responseData === 'string'
                      ? selectedEntry.responseData
                      : JSON.stringify(selectedEntry.responseData, null, 2)}
                  </pre>
                </AccordionDetails>
              </Accordion>
            )}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 过滤器 */}
      <Box sx={{ p: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <TextField
            size="small"
            placeholder="过滤网络请求..."
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
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={filter.onlyErrors}
                  onChange={(e) => setFilter(prev => ({ ...prev, onlyErrors: e.target.checked }))}
                />
              }
              label="仅错误"
            />
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={!filter.hideDataUrls}
                  onChange={(e) => setFilter(prev => ({ ...prev, hideDataUrls: !e.target.checked }))}
                />
              }
              label="Data URLs"
            />
          </Box>
        </Box>
      </Box>

      {/* 网络请求列表 */}
      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        <List dense sx={{ p: 0 }}>
          {filteredEntries.map((entry) => (
            <ListItem
              key={entry.id}
              sx={{
                py: 1,
                px: 2,
                borderBottom: '1px solid',
                borderColor: 'divider',
                '&:hover': { bgcolor: 'action.hover' },
                cursor: 'pointer'
              }}
              onClick={() => handleEntryClick(entry)}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 1 }}>
                <Chip
                  label={entry.method}
                  size="small"
                  sx={{
                    bgcolor: networkService.getMethodColor(entry.method),
                    color: 'white',
                    fontWeight: 'bold',
                    minWidth: '60px'
                  }}
                />
                <Chip
                  label={entry.statusCode || entry.status}
                  size="small"
                  color={entry.status === 'success' ? 'success' : entry.status === 'error' ? 'error' : 'default'}
                />
                <Box sx={{ flexGrow: 1, minWidth: 0, mx: 1 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {entry.url}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 2, minWidth: 'fit-content' }}>
                  <Typography variant="caption" color="text.secondary">
                    {entry.duration ? networkService.formatDuration(entry.duration) : '-'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {entry.responseSize ? networkService.formatSize(entry.responseSize) : '-'}
                  </Typography>
                </Box>
              </Box>
            </ListItem>
          ))}
        </List>
      </Box>

      {renderDetailsDialog()}
    </Box>
  );
};

export default NetworkPanel;