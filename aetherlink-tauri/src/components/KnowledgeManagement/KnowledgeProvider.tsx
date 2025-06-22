import React, { createContext, useContext, useState, useEffect } from 'react';
import { MobileKnowledgeService } from '../../shared/services/knowledge/MobileKnowledgeService';
import { EventEmitter, EVENT_NAMES } from '../../shared/services/EventService';
import type { KnowledgeBase } from '../../shared/types/KnowledgeBase';

interface KnowledgeContextType {
  knowledgeBases: KnowledgeBase[];
  selectedKnowledgeBase: KnowledgeBase | null;
  isLoading: boolean;
  error: string | null;
  refreshKnowledgeBases: () => Promise<void>;
  selectKnowledgeBase: (id: string | null) => void;
}

const KnowledgeContext = createContext<KnowledgeContextType | null>(null);

export const useKnowledge = () => {
  const context = useContext(KnowledgeContext);
  if (!context) {
    throw new Error('useKnowledge must be used within a KnowledgeProvider');
  }
  return context;
};

interface KnowledgeProviderProps {
  children: React.ReactNode;
}

export const KnowledgeProvider: React.FC<KnowledgeProviderProps> = ({ children }) => {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedKnowledgeBase, setSelectedKnowledgeBase] = useState<KnowledgeBase | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchKnowledgeBases = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const bases = await MobileKnowledgeService.getInstance().getAllKnowledgeBases();
      setKnowledgeBases(bases);
      
      // 如果有已选择的知识库，更新它的信息
      if (selectedKnowledgeBase) {
        const updated = bases.find(b => b.id === selectedKnowledgeBase.id);
        if (updated) {
          setSelectedKnowledgeBase(updated);
        } else {
          setSelectedKnowledgeBase(null);
        }
      }
    } catch (err) {
      console.error('Error fetching knowledge bases:', err);
      setError('获取知识库列表失败');
    } finally {
      setIsLoading(false);
    }
  };
  
  const selectKnowledgeBase = async (id: string | null) => {
    if (!id) {
      setSelectedKnowledgeBase(null);
      return;
    }
    
    try {
      const knowledgeBase = await MobileKnowledgeService.getInstance().getKnowledgeBase(id);
      if (knowledgeBase) {
        setSelectedKnowledgeBase(knowledgeBase);
      } else {
        console.warn(`Knowledge base with ID ${id} not found`);
        setSelectedKnowledgeBase(null);
      }
    } catch (err) {
      console.error(`Error selecting knowledge base ${id}:`, err);
      setSelectedKnowledgeBase(null);
    }
  };

  useEffect(() => {
    fetchKnowledgeBases();

    // 监听知识库相关事件
    const createdUnsubscribe = EventEmitter.on(
      EVENT_NAMES.KNOWLEDGE_BASE_CREATED,
      () => fetchKnowledgeBases()
    );
    
    const updatedUnsubscribe = EventEmitter.on(
      EVENT_NAMES.KNOWLEDGE_BASE_UPDATED,
      () => fetchKnowledgeBases()
    );
    
    const deletedUnsubscribe = EventEmitter.on(
      EVENT_NAMES.KNOWLEDGE_BASE_DELETED,
      () => fetchKnowledgeBases()
    );

    return () => {
      createdUnsubscribe();
      updatedUnsubscribe();
      deletedUnsubscribe();
    };
  }, []);

  const value = {
    knowledgeBases,
    selectedKnowledgeBase,
    isLoading,
    error,
    refreshKnowledgeBases: fetchKnowledgeBases,
    selectKnowledgeBase,
  };

  return <KnowledgeContext.Provider value={value}>{children}</KnowledgeContext.Provider>;
};

export default KnowledgeProvider; 