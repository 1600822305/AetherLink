import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { Assistant, ChatTopic } from '../../types/Assistant';
import { getDefaultTopic } from '../../services/assistant/types';

interface AssistantsState {
  assistants: Assistant[];
  currentAssistant: Assistant | null;
}

const initialState: AssistantsState = {
  assistants: [],
  currentAssistant: null
};

// 辅助函数：同步更新 currentAssistant
const syncCurrentAssistant = (state: AssistantsState, assistantId: string, updatedAssistant: Assistant) => {
  if (state.currentAssistant && state.currentAssistant.id === assistantId) {
    state.currentAssistant = updatedAssistant;
  }
};

const assistantsSlice = createSlice({
  name: 'assistants',
  initialState,
  reducers: {
    setAssistants: (state, action: PayloadAction<Assistant[]>) => {
      console.log(`[assistantsSlice] 设置助手列表，数量: ${action.payload.length}`);

      // 检查是否有头像（支持emoji、avatar、icon任意一种）
      const assistantsWithoutAvatar = action.payload.filter(a => !a.emoji && !a.avatar && !a.icon);
      if (assistantsWithoutAvatar.length > 0) {
        console.warn(`[assistantsSlice] 发现 ${assistantsWithoutAvatar.length} 个助手没有设置头像（emoji、avatar或icon）:`,
          assistantsWithoutAvatar.map(a => ({ id: a.id, name: a.name }))
        );
      }

      state.assistants = action.payload;
    },
    setCurrentAssistant: (state, action: PayloadAction<Assistant | null>) => {
      state.currentAssistant = action.payload;
    },
    addTopic: (state, action: PayloadAction<{ assistantId: string; topic: ChatTopic }>) => {
      const { assistantId, topic } = action.payload;
      const assistant = state.assistants.find(a => a.id === assistantId);
      if (assistant) {
        if (!assistant.topicIds) {
          assistant.topicIds = [];
        }

        if (!assistant.topics) {
          assistant.topics = [];
        }

        if (!assistant.topicIds.includes(topic.id)) {
          assistant.topicIds.push(topic.id);
        }

        if (!assistant.topics.some(t => t.id === topic.id)) {
          assistant.topics.push(topic);
        }

        // 使用辅助函数同步更新 currentAssistant
        syncCurrentAssistant(state, assistantId, assistant);

        console.log(`[assistantsSlice] 添加话题 ${topic.id} 到助手 ${assistantId}，当前话题数量: ${assistant.topics.length}`);
      }
    },
    removeTopic: (state, action: PayloadAction<{ assistantId: string; topicId: string }>) => {
      const { assistantId, topicId } = action.payload;
      const assistant = state.assistants.find(a => a.id === assistantId);
      if (assistant) {
        assistant.topicIds = assistant.topicIds.filter(id => id !== topicId);

        if (assistant.topics) {
          assistant.topics = assistant.topics.filter(t => t.id !== topicId);
        }

        // 🔥 Cherry Studio模式：如果删除后没有话题了，自动创建默认话题
        if (assistant.topicIds.length === 0) {
          const defaultTopic = getDefaultTopic(assistantId);
          assistant.topicIds = [defaultTopic.id];
          assistant.topics = [defaultTopic];
          console.log(`[assistantsSlice] 助手 ${assistantId} 没有话题了，自动创建默认话题: ${defaultTopic.id}`);
        }

        // 使用辅助函数同步更新 currentAssistant
        syncCurrentAssistant(state, assistantId, assistant);

        console.log(`[assistantsSlice] 从助手 ${assistantId} 移除话题 ${topicId}，剩余话题数量: ${assistant.topics?.length || 0}`);
      }
    },
    updateTopic: (state, action: PayloadAction<{ assistantId: string; topic: ChatTopic }>) => {
      const { assistantId, topic } = action.payload;
      const assistant = state.assistants.find(a => a.id === assistantId);
      if (assistant) {
        if (!assistant.topics) {
          assistant.topics = [];
        }

        const index = assistant.topics.findIndex(t => t.id === topic.id);
        if (index !== -1) {
          assistant.topics[index] = topic;
          console.log(`[assistantsSlice] 更新助手 ${assistantId} 的话题 ${topic.id}`);
        } else {
          if (assistant.topicIds.includes(topic.id)) {
            assistant.topics.push(topic);
            console.log(`[assistantsSlice] 添加话题 ${topic.id} 到助手 ${assistantId} 的topics数组`);
          }
        }

        // 使用辅助函数同步更新 currentAssistant
        syncCurrentAssistant(state, assistantId, assistant);
      }
    },
    updateAssistantTopics: (state, action: PayloadAction<{ assistantId: string; topics: ChatTopic[] }>) => {
      const { assistantId, topics } = action.payload;
      const assistant = state.assistants.find(a => a.id === assistantId);
      if (assistant) {
        assistant.topics = topics;
        assistant.topicIds = topics.map(topic => topic.id);

        // 同步更新 currentAssistant
        syncCurrentAssistant(state, assistantId, assistant);

        console.log(`[assistantsSlice] 更新助手 ${assistantId} 的话题，数量: ${topics.length}，topicIds: ${assistant.topicIds.join(', ')}`);
      }
    },
    // 添加新的reducers，类似最佳实例
    addAssistant: (state, action: PayloadAction<Assistant>) => {
      // 优化：直接查找索引，避免重复查找
      const existingIndex = state.assistants.findIndex(a => a.id === action.payload.id);

      if (existingIndex !== -1) {
        // 如果存在，更新它
        state.assistants[existingIndex] = action.payload;
        // 同步更新 currentAssistant
        syncCurrentAssistant(state, action.payload.id, action.payload);
      } else {
        // 如果不存在，添加新助手
        state.assistants.push(action.payload);
      }
      console.log(`[assistantsSlice] 添加助手: ${action.payload.id} (${action.payload.name})`);
    },
    updateAssistant: (state, action: PayloadAction<Assistant>) => {
      const index = state.assistants.findIndex(a => a.id === action.payload.id);
      if (index !== -1) {
        const oldAssistant = state.assistants[index];
        state.assistants[index] = action.payload;

        // 使用辅助函数同步更新 currentAssistant
        syncCurrentAssistant(state, action.payload.id, action.payload);

        // 详细日志记录头像变化
        if (oldAssistant.emoji !== action.payload.emoji ||
            oldAssistant.avatar !== action.payload.avatar ||
            oldAssistant.icon !== action.payload.icon) {
          console.log(`[assistantsSlice] 助手头像更新: ${action.payload.id} (${action.payload.name})`, {
            old: { emoji: oldAssistant.emoji, avatar: oldAssistant.avatar, icon: !!oldAssistant.icon },
            new: { emoji: action.payload.emoji, avatar: action.payload.avatar, icon: !!action.payload.icon }
          });
        }

        // 记录话题数变化
        const oldTopicCount = oldAssistant.topics?.length || oldAssistant.topicIds?.length || 0;
        const newTopicCount = action.payload.topics?.length || action.payload.topicIds?.length || 0;
        if (oldTopicCount !== newTopicCount) {
          console.log(`[assistantsSlice] 助手话题数变化: ${action.payload.id} (${action.payload.name})`, {
            oldCount: oldTopicCount,
            newCount: newTopicCount
          });
        }

        console.log(`[assistantsSlice] 更新助手: ${action.payload.id} (${action.payload.name}), 话题数: ${newTopicCount}`);
      } else {
        console.warn(`[assistantsSlice] 未找到要更新的助手: ${action.payload.id}`);
      }
    },
    removeAssistant: (state, action: PayloadAction<string>) => {
      const assistantId = action.payload;
      state.assistants = state.assistants.filter(a => a.id !== assistantId);

      // 如果删除的是当前选中的助手，清除currentAssistant
      if (state.currentAssistant && state.currentAssistant.id === assistantId) {
        state.currentAssistant = null;
      }

      console.log(`[assistantsSlice] 删除助手: ${assistantId}`);
    }
  }
});

export const {
  setAssistants,
  setCurrentAssistant,
  addTopic,
  removeTopic,
  updateTopic,
  updateAssistantTopics,
  addAssistant,
  updateAssistant,
  removeAssistant
} = assistantsSlice.actions;
export default assistantsSlice.reducer;