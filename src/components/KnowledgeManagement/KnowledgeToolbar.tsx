import React, { useState } from 'react';
import {
  Box,
  IconButton,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Badge,
  Drawer,
  Typography,
  Divider,
} from '@mui/material';
import {
  Database,
  Search,
  Plus,
  BookOpen,
  Upload,
  X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { KnowledgeSearch } from './KnowledgeSearch';

interface KnowledgeToolbarProps {
  currentKnowledgeBaseId?: string;
  onSearchClick?: () => void;
  onUploadClick?: () => void;
}

export const KnowledgeToolbar: React.FC<KnowledgeToolbarProps> = ({
  currentKnowledgeBaseId,
  onSearchClick,
  onUploadClick,
}) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [searchDrawerOpen, setSearchDrawerOpen] = useState(false);

  const handleSearchClick = () => {
    if (onSearchClick) {
      onSearchClick();
    } else if (currentKnowledgeBaseId) {
      setSearchDrawerOpen(true);
    }
  };

  const handleUploadClick = () => {
    if (onUploadClick) {
      onUploadClick();
    }
  };

  const handleListClick = () => {
    navigate('/knowledge');
  };

  const actions = [
    { icon: <Search size={20} />, name: '搜索知识', action: handleSearchClick, disabled: !currentKnowledgeBaseId },
    { icon: <Upload size={20} />, name: '上传文件', action: handleUploadClick, disabled: !currentKnowledgeBaseId },
    { icon: <Plus size={20} />, name: '新建知识库', action: () => navigate('/knowledge/create') },
    { icon: <BookOpen size={20} />, name: '知识库列表', action: handleListClick },
  ];

  return (
    <>
      <SpeedDial
        ariaLabel="知识库工具"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        icon={
          <Badge color="primary" variant="dot" invisible={!currentKnowledgeBaseId}>
            <SpeedDialIcon icon={<Database size={20} />} />
          </Badge>
        }
        onClose={() => setOpen(false)}
        onOpen={() => setOpen(true)}
        open={open}
        direction="up"
      >
        {actions.map((action) => (
          <SpeedDialAction
            key={action.name}
            icon={action.icon}
            title={action.name}
            onClick={() => {
              setOpen(false);
              action.action();
            }}
            sx={{ display: action.disabled ? 'none' : 'flex' }}
          />
        ))}
      </SpeedDial>

      {/* 搜索抽屉 */}
      <Drawer
        anchor="right"
        open={searchDrawerOpen}
        onClose={() => setSearchDrawerOpen(false)}
        slotProps={{
          paper: {
            sx: { width: { xs: '100%', sm: 400 }, p: 2 }
          }
        }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">知识库搜索</Typography>
          <IconButton onClick={() => setSearchDrawerOpen(false)}>
            <X size={20} />
          </IconButton>
        </Box>
        <Divider sx={{ mb: 2 }} />
        {currentKnowledgeBaseId && (
          <KnowledgeSearch knowledgeBaseId={currentKnowledgeBaseId} />
        )}
      </Drawer>

    </>
  );
};

export default KnowledgeToolbar;
