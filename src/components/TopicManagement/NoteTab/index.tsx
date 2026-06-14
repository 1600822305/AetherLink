import React from 'react';
import { Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import NoteList from './NoteList';

const NoteTab: React.FC = () => {
  const navigate = useNavigate();

  const handleSelectNote = (path: string) => {
    // 从路径中提取文件名
    const fileName = path.split('/').pop() || '未命名笔记';
    // 跳转到编辑器页面，添加 from=chat 参数标记来源
    navigate(`/settings/notes/edit?path=${encodeURIComponent(path)}&name=${encodeURIComponent(fileName)}&from=chat`);
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <NoteList onSelectNote={handleSelectNote} />
    </Box>
  );
};

export default NoteTab;
