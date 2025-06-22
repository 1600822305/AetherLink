import React from 'react';
import { Routes, Route } from 'react-router-dom';
import KnowledgeBaseList from './KnowledgeBaseList';
import KnowledgeBaseDetail from './KnowledgeBaseDetail';

/**
 * 知识库功能的根组件
 */
const KnowledgeBase: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<KnowledgeBaseList />} />
      <Route path="/:id" element={<KnowledgeBaseDetail />} />
    </Routes>
  );
};

export default KnowledgeBase; 