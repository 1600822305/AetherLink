import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Paper,
  Card,
  CardContent,
  CardActions,
  Divider,
  Avatar,
  IconButton,
  AppBar,
  Toolbar,
  Alert,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  Folder,
  Trash2,
  Edit,
  Plus,
  Eye,
  ArrowLeft
} from 'lucide-react';
import { MobileKnowledgeService } from '../../shared/services/knowledge/MobileKnowledgeService';
import type { KnowledgeBase } from '../../shared/types/KnowledgeBase';
import { useNavigate } from 'react-router-dom';
import { useKnowledge } from '../../components/KnowledgeManagement/KnowledgeProvider';
import CreateKnowledgeDialog from '../../components/KnowledgeManagement/CreateKnowledgeDialog';

const Container = styled(Box)(() => ({
  flexGrow: 1,
  display: 'flex',
  flexDirection: 'column',
  minHeight: '100vh',
  position: 'relative',
  overflow: 'hidden',
}));

const StyledCard = styled(Card)(({ theme }) => ({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  transition: 'transform 0.2s, box-shadow 0.2s',
  cursor: 'pointer',
  borderRadius: (theme.shape.borderRadius as number) * 2,
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: theme.shadows[4],
  },
}));

const KnowledgeBaseList: React.FC = () => {
  const navigate = useNavigate();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingKnowledgeBase, setEditingKnowledgeBase] = useState<KnowledgeBase | null>(null);

  const {
    knowledgeBases,
    isLoading,
    error,
    refreshKnowledgeBases
  } = useKnowledge();

  // 导航到详情页
  const handleViewDetails = (id: string) => {
    navigate(`/knowledge/${id}`);
  };

  // 返回到设置页面
  const handleBack = () => {
    navigate('/settings');
  };

  // 打开添加/编辑对话框
  const handleOpenDialog = (knowledgeBase?: KnowledgeBase) => {
    if (knowledgeBase) {
      setEditingKnowledgeBase(knowledgeBase);
    } else {
      setEditingKnowledgeBase(null);
    }
    setCreateDialogOpen(true);
  };

  // 关闭对话框
  const handleCloseDialog = () => {
    setCreateDialogOpen(false);
    setEditingKnowledgeBase(null);
  };

  // 提交表单
  const handleSubmitKnowledgeBase = async (formData: Partial<KnowledgeBase>) => {
    try {
      if (editingKnowledgeBase) {
        // 更新现有知识库
        await MobileKnowledgeService.getInstance().updateKnowledgeBase(
          editingKnowledgeBase.id,
          formData
        );
      } else {
        // 创建新知识库
        const createdKB = await MobileKnowledgeService.getInstance().createKnowledgeBase(formData as any);
        navigate(`/knowledge/${createdKB.id}`);
      }
      handleCloseDialog();
      refreshKnowledgeBases();
    } catch (error) {
      console.error('保存知识库失败:', error);
    }
  };

  // 打开删除确认对话框
  const handleOpenDeleteDialog = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止冒泡到卡片点击
    setDeleteTargetId(id);
    setDeleteDialogOpen(true);
  };

  // 关闭删除确认对话框
  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setDeleteTargetId(null);
  };

  // 删除知识库
  const handleDelete = async () => {
    if (!deleteTargetId) return;

    try {
      await MobileKnowledgeService.getInstance().deleteKnowledgeBase(deleteTargetId);
      handleCloseDeleteDialog();
      refreshKnowledgeBases();
    } catch (error) {
      console.error('删除知识库失败:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <Container>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          bgcolor: 'background.paper',
          color: 'text.primary',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Toolbar>
          <IconButton
            edge="start"
            onClick={handleBack}
            aria-label="back"
            sx={{ color: (theme) => theme.palette.primary.main }}
          >
            <ArrowLeft size={20} />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 600 }}>
            知识库管理
          </Typography>
          <Button
            variant="contained"
            startIcon={<Plus size={20} />}
            onClick={() => handleOpenDialog()}
            sx={{
              background: 'linear-gradient(45deg, #059669 30%, #10b981 90%)',
              '&:hover': {
                background: 'linear-gradient(45deg, #047857 30%, #059669 90%)',
              }
            }}
          >
            添加知识库
          </Button>
        </Toolbar>
      </AppBar>

      <Box sx={{ flexGrow: 1, overflow: 'auto', px: 2, py: 2, mt: 8 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {isLoading ? (
          <Box display="flex" justifyContent="center" my={5}>
            <CircularProgress />
          </Box>
        ) : knowledgeBases.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center', my: 5, borderRadius: 2 }}>
            <Typography variant="body1" color="textSecondary" gutterBottom>
              暂无知识库
            </Typography>
            <Button
              variant="contained"
              startIcon={<Plus size={20} />}
              onClick={() => handleOpenDialog()}
              sx={{
                mt: 2,
                background: 'linear-gradient(45deg, #059669 30%, #10b981 90%)',
                '&:hover': {
                  background: 'linear-gradient(45deg, #047857 30%, #059669 90%)',
                }
              }}
            >
              创建第一个知识库
            </Button>
          </Paper>
        ) : (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', margin: -1 }}>
            {knowledgeBases.map((kb) => (
              <Box key={kb.id} sx={{ width: { xs: '100%', sm: '50%', md: '33.33%' }, p: 1 }}>
                <StyledCard onClick={() => handleViewDetails(kb.id)}>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box display="flex" alignItems="center" mb={1}>
                      <Avatar sx={{ mr: 1, bgcolor: 'primary.main' }}>
                        <Folder size={20} />
                      </Avatar>
                      <Typography variant="h6" noWrap>{kb.name}</Typography>
                    </Box>

                    <Typography variant="body2" color="text.secondary" sx={{
                      mb: 2,
                      height: 40,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}>
                      {kb.description || '无描述'}
                    </Typography>

                    <Box display="flex" flexWrap="wrap" gap={0.5}>
                      <Typography variant="caption" color="text.secondary">
                        模型: {kb.model}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        • 创建: {formatDate(kb.created_at)}
                      </Typography>
                    </Box>
                  </CardContent>
                  <Divider />
                  <CardActions>
                    <IconButton size="small" onClick={(e) => {
                      e.stopPropagation();
                      handleOpenDialog(kb);
                    }}>
                      <Edit size={16} />
                    </IconButton>
                    <IconButton size="small" onClick={(e) => handleOpenDeleteDialog(kb.id, e)}>
                      <Trash2 size={16} />
                    </IconButton>
                    <Box flexGrow={1} />
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Eye size={16} />}
                      onClick={() => handleViewDetails(kb.id)}
                    >
                      查看
                    </Button>
                  </CardActions>
                </StyledCard>
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* 添加/编辑对话框 */}
      <CreateKnowledgeDialog
        open={createDialogOpen}
        onClose={handleCloseDialog}
        onSave={handleSubmitKnowledgeBase}
        initialData={editingKnowledgeBase || undefined}
        isEditing={!!editingKnowledgeBase}
      />

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent>
          <Typography>确认要删除这个知识库吗？此操作将删除所有相关文档，无法撤销。</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog}>取消</Button>
          <Button onClick={handleDelete} color="error">删除</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default KnowledgeBaseList;