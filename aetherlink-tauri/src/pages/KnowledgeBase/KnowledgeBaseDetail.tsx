import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Chip,
  CircularProgress,
  Tab,
  Tabs,
  IconButton,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { ArrowLeft } from 'lucide-react';
import DocumentManager from '../../components/KnowledgeManagement/DocumentManager';
import { KnowledgeSearch } from '../../components/KnowledgeManagement/KnowledgeSearch';
import { useKnowledge } from '../../components/KnowledgeManagement/KnowledgeProvider';

const Container = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  maxWidth: 1000,
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  minHeight: '100vh',
  position: 'relative',
}));

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`knowledge-tabpanel-${index}`}
      aria-labelledby={`knowledge-tab-${index}`}
      style={{ width: '100%', overflow: 'visible' }}
      {...other}
    >
      {value === index && (
        <Box sx={{ pt: 2 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const KnowledgeBaseDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);
  const { selectKnowledgeBase, selectedKnowledgeBase } = useKnowledge();

  useEffect(() => {
    if (id) {
      selectKnowledgeBase(id);
    }
  }, [id, selectKnowledgeBase]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleGoBack = () => {
    navigate('/knowledge');
  };

  if (!id) {
    navigate('/knowledge');
    return null;
  }

  return (
    <Container>
      <Box display="flex" alignItems="center" mb={2} position="sticky" top={0} bgcolor="background.paper" zIndex={1}>
        <IconButton onClick={handleGoBack} size="small" sx={{ mr: 1 }}>
          <ArrowLeft size={20} />
        </IconButton>
        <Typography variant="h5" component="h1" sx={{ flexGrow: 1 }}>
          {selectedKnowledgeBase?.name || '知识库详情'}
        </Typography>
      </Box>

      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        {selectedKnowledgeBase ? (
          <>
            <Paper elevation={0} sx={{ mb: 2, p: 2 }}>
              <Typography variant="body1" paragraph>
                {selectedKnowledgeBase.description || '没有描述'}
              </Typography>
              <Box display="flex" gap={1} flexWrap="wrap">
                <Chip 
                  label={`模型: ${selectedKnowledgeBase.model}`} 
                  size="small" 
                  color="primary" 
                  variant="outlined"
                />
                <Chip 
                  label={`维度: ${selectedKnowledgeBase.dimensions}`} 
                  size="small" 
                  color="primary" 
                  variant="outlined"
                />
                <Chip 
                  label={`块大小: ${selectedKnowledgeBase.chunkSize}`} 
                  size="small" 
                  color="primary" 
                  variant="outlined"
                />
                <Chip 
                  label={`重叠: ${selectedKnowledgeBase.chunkOverlap}`} 
                  size="small" 
                  color="primary" 
                  variant="outlined"
                />
                <Chip 
                  label={`阈值: ${selectedKnowledgeBase.threshold}`} 
                  size="small" 
                  color="primary" 
                  variant="outlined"
                />
              </Box>
            </Paper>

            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs 
                value={tabValue} 
                onChange={handleTabChange} 
                aria-label="知识库功能标签"
                variant="fullWidth"
              >
                <Tab label="文档管理" />
                <Tab label="知识搜索" />
              </Tabs>
            </Box>

            <TabPanel value={tabValue} index={0}>
              <DocumentManager knowledgeBaseId={id} />
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
              <KnowledgeSearch knowledgeBaseId={id} />
            </TabPanel>
          </>
        ) : (
          <Box display="flex" justifyContent="center" alignItems="center" height="50vh">
            <CircularProgress />
          </Box>
        )}
      </Box>
    </Container>
  );
};

export default KnowledgeBaseDetail; 