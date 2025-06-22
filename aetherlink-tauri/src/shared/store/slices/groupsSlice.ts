import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Group } from '../../types';
import { nanoid } from '../../utils';
import { getStorageItem, setStorageItem } from '../../utils/storage';
import { makeSerializable, diagnoseSerializationIssues } from '../../utils/serialization';
import { dexieStorage } from '../../services/storage/DexieStorageService';

// 类型定义
type AppDispatch = any;
type RootState = { groups: GroupsState };

interface GroupsState {
  groups: Group[];
  assistantGroupMap: Record<string, string>; // assistantId -> groupId
  topicGroupMap: Record<string, Record<string, string>>; // assistantId -> (topicId -> groupId)
  error: string | null;
  loading: boolean;
}

const initialState: GroupsState = {
  groups: [],
  assistantGroupMap: {},
  topicGroupMap: {}, // 现在是嵌套结构：assistantId -> (topicId -> groupId)
  error: null,
  loading: false
};

/**
 * 安全地保存分组数据到存储
 * 确保数据是可序列化的
 */
const saveGroupsToStorage = async (groups: Group[]): Promise<void> => {
  try {


    // 先诊断数据是否存在序列化问题
    const { hasCircularRefs, nonSerializableProps } = diagnoseSerializationIssues(groups);

    if (hasCircularRefs || nonSerializableProps.length > 0) {
      console.warn('分组数据存在序列化问题，将尝试修复：', {
        hasCircularRefs,
        nonSerializableProps
      });
    }

    // 使用makeSerializable确保数据可序列化
    const serializableGroups = makeSerializable(groups);

    // 直接使用dexieStorage保存，避免中间层
    await dexieStorage.saveSetting('groups', serializableGroups);

    // 同时使用setStorageItem作为备份方式
    await setStorageItem('groups', serializableGroups);


  } catch (error) {
    console.error('保存分组失败:', error);
    // 记录更详细的错误信息，帮助诊断问题
    if (error instanceof Error) {
      console.error('错误类型:', error.name);
      console.error('错误消息:', error.message);
      console.error('错误堆栈:', error.stack);
    }
  }
};

/**
 * 安全地保存映射数据到存储
 */
const saveMapToStorage = async (key: string, map: Record<string, any>): Promise<void> => {
  try {
    if (process.env.NODE_ENV === 'development') {
      console.log(`开始保存${key}数据...`);
    }

    // 先诊断数据是否存在序列化问题
    const { hasCircularRefs, nonSerializableProps } = diagnoseSerializationIssues(map);

    if (hasCircularRefs || nonSerializableProps.length > 0) {
      console.warn(`${key}数据存在序列化问题，将尝试修复：`, {
        hasCircularRefs,
        nonSerializableProps
      });
    }

    // 使用makeSerializable确保数据可序列化
    const serializableMap = makeSerializable(map);

    // 直接使用dexieStorage保存，避免中间层
    await dexieStorage.saveSetting(key, serializableMap);

    // 同时使用setStorageItem作为备份方式
    await setStorageItem(key, serializableMap);

    if (process.env.NODE_ENV === 'development') {
      console.log(`${key}数据保存成功`);
    }
  } catch (error) {
    console.error(`保存${key}失败:`, error);
    // 记录更详细的错误信息
    if (error instanceof Error) {
      console.error('错误类型:', error.name);
      console.error('错误消息:', error.message);
      console.error('错误堆栈:', error.stack);
    }
  }
};

// 初始化函数，从IndexedDB加载数据
const initializeGroups = async (dispatch: any) => {
  try {


    // 尝试直接从dexieStorage加载
    let savedGroups: Group[] | null = null;
    let savedAssistantGroupMap: Record<string, string> | null = null;
    let savedTopicGroupMap: Record<string, Record<string, string>> | null = null;

    try {
      // 首先尝试直接从dexieStorage加载
      savedGroups = await dexieStorage.getSetting('groups');
      savedAssistantGroupMap = await dexieStorage.getSetting('assistantGroupMap');
      savedTopicGroupMap = await dexieStorage.getSetting('topicGroupMap');

      // 如果topicGroupMap是旧格式（Record<string, string>），需要迁移
      if (savedTopicGroupMap && typeof savedTopicGroupMap === 'object') {
        const firstValue = Object.values(savedTopicGroupMap)[0];
        if (typeof firstValue === 'string') {
          // 这是旧格式，需要迁移
          console.log('检测到旧格式的topicGroupMap，开始迁移...');
          const oldMap = savedTopicGroupMap as unknown as Record<string, string>;
          const newMap: Record<string, Record<string, string>> = {};

          // 由于旧格式没有assistantId信息，我们需要从groups中获取
          if (savedGroups) {
            for (const [topicId, groupId] of Object.entries(oldMap)) {
              const group = savedGroups.find(g => g.id === groupId && g.type === 'topic');
              if (group && group.assistantId) {
                if (!newMap[group.assistantId]) {
                  newMap[group.assistantId] = {};
                }
                newMap[group.assistantId][topicId] = groupId;
              }
            }
          }
          savedTopicGroupMap = newMap;

          // 保存迁移后的数据
          await dexieStorage.saveSetting('topicGroupMap', newMap);
          console.log('topicGroupMap迁移完成');
        }
      }

    } catch (dexieError) {
      console.warn('从dexieStorage直接加载分组数据失败，尝试使用getStorageItem:', dexieError);

      // 如果直接加载失败，尝试使用getStorageItem
      savedGroups = await getStorageItem<Group[]>('groups');
      savedAssistantGroupMap = await getStorageItem<Record<string, string>>('assistantGroupMap');
      const oldTopicGroupMap = await getStorageItem<Record<string, string>>('topicGroupMap');

      // 处理旧格式的topicGroupMap
      if (oldTopicGroupMap && savedGroups) {
        const newMap: Record<string, Record<string, string>> = {};
        for (const [topicId, groupId] of Object.entries(oldTopicGroupMap)) {
          const group = savedGroups.find(g => g.id === groupId && g.type === 'topic');
          if (group && group.assistantId) {
            if (!newMap[group.assistantId]) {
              newMap[group.assistantId] = {};
            }
            newMap[group.assistantId][topicId] = groupId;
          }
        }
        savedTopicGroupMap = newMap;
      }
    }



    const payload = {
      groups: savedGroups || [],
      assistantGroupMap: savedAssistantGroupMap || {},
      topicGroupMap: savedTopicGroupMap || {}
    };

    dispatch(loadGroupsSuccess(payload));
  } catch (error) {
    console.error('加载分组数据失败:', error);
    if (error instanceof Error) {
      console.error('错误类型:', error.name);
      console.error('错误消息:', error.message);
      console.error('错误堆栈:', error.stack);
    }
  }
};

const groupsSlice = createSlice({
  name: 'groups',
  initialState,
  reducers: {
    // 加载分组数据成功
    loadGroupsSuccess: (state, action: PayloadAction<{
      groups: Group[];
      assistantGroupMap: Record<string, string>;
      topicGroupMap: Record<string, Record<string, string>>;
    }>) => {
      state.groups = action.payload.groups;
      state.assistantGroupMap = action.payload.assistantGroupMap;
      state.topicGroupMap = action.payload.topicGroupMap;
      state.error = null;
      state.loading = false;
    },

    // 设置错误状态
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.loading = false;
    },

    // 清除错误状态
    clearError: (state) => {
      state.error = null;
    },

    // 设置加载状态
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },

    // 创建新分组
    createGroup: (state, action: PayloadAction<{ name: string; type: 'assistant' | 'topic'; assistantId?: string }>) => {
      const { name, type, assistantId } = action.payload;

      // 对于话题分组，assistantId是必需的
      if (type === 'topic' && !assistantId) {
        state.error = '创建话题分组时必须提供assistantId';
        return;
      }

      state.error = null; // 清除错误
      const newGroup: Group = {
        id: nanoid(),
        name,
        type,
        assistantId: type === 'topic' ? assistantId : undefined,
        items: [],
        order: state.groups.filter(g => g.type === type && (type === 'assistant' || g.assistantId === assistantId)).length,
        expanded: true
      };
      state.groups.push(newGroup);
    },

    // 更新分组
    updateGroup: (state, action: PayloadAction<{ id: string; changes: Partial<Omit<Group, 'id' | 'type'>> }>) => {
      const { id, changes } = action.payload;
      const group = state.groups.find(g => g.id === id);
      if (group) {
        Object.assign(group, changes);
        state.error = null;
      }
    },

    // 删除分组
    deleteGroup: (state, action: PayloadAction<string>) => {
      const groupId = action.payload;
      const group = state.groups.find(g => g.id === groupId);

      if (group) {
        // 清除该分组中所有项目的映射
        if (group.type === 'assistant') {
          for (const assistantId of group.items) {
            delete state.assistantGroupMap[assistantId];
          }
        } else if (group.type === 'topic' && group.assistantId) {
          // 从对应助手的topicGroupMap中删除话题映射
          if (state.topicGroupMap[group.assistantId]) {
            for (const topicId of group.items) {
              delete state.topicGroupMap[group.assistantId][topicId];
            }
          }
        }

        // 移除分组
        state.groups = state.groups.filter(g => g.id !== groupId);

        // 重新排序同类型且同助手的分组
        state.groups
          .filter(g => g.type === group.type && (group.type === 'assistant' || g.assistantId === group.assistantId))
          .sort((a, b) => a.order - b.order)
          .forEach((g, index) => {
            g.order = index;
          });

        state.error = null;
      }
    },

    // 将项目添加到分组
    addItemToGroup: (state, action: PayloadAction<{ groupId: string; itemId: string }>) => {
      const { groupId, itemId } = action.payload;
      const group = state.groups.find(g => g.id === groupId);

      if (group) {
        // 避免重复添加
        if (!group.items.includes(itemId)) {
          group.items.push(itemId);

          // 更新映射
          if (group.type === 'assistant') {
            state.assistantGroupMap[itemId] = groupId;
          } else if (group.type === 'topic' && group.assistantId) {
            // 确保助手的topicGroupMap存在
            if (!state.topicGroupMap[group.assistantId]) {
              state.topicGroupMap[group.assistantId] = {};
            }
            state.topicGroupMap[group.assistantId][itemId] = groupId;
          }

          state.error = null;
        }
      }
    },

    // 从分组中移除项目
    removeItemFromGroup: (state, action: PayloadAction<{ itemId: string; type: 'assistant' | 'topic'; assistantId?: string }>) => {
      const { itemId, type, assistantId } = action.payload;

      let groupId: string | undefined;

      // 确定项目当前所在的分组
      if (type === 'assistant') {
        groupId = state.assistantGroupMap[itemId];
      } else if (type === 'topic' && assistantId) {
        groupId = state.topicGroupMap[assistantId]?.[itemId];
      }

      if (groupId) {
        const group = state.groups.find(g => g.id === groupId);
        if (group) {
          group.items = group.items.filter(id => id !== itemId);

          // 从映射中删除
          if (type === 'assistant') {
            delete state.assistantGroupMap[itemId];
          } else if (type === 'topic' && assistantId && state.topicGroupMap[assistantId]) {
            delete state.topicGroupMap[assistantId][itemId];
          }

          state.error = null;
        }
      }
    },

    // 重新排序分组
    reorderGroups: (state, action: PayloadAction<{ type: 'assistant' | 'topic'; newOrder: string[]; assistantId?: string }>) => {
      const { type, newOrder, assistantId } = action.payload;

      // 按新顺序重新排序分组
      state.groups
        .filter(g => g.type === type && (type === 'assistant' || g.assistantId === assistantId))
        .forEach(g => {
          const newIndex = newOrder.findIndex(id => id === g.id);
          if (newIndex !== -1) {
            g.order = newIndex;
          }
        });

      state.error = null;
    },

    // 重新排序分组内的项目
    reorderItemsInGroup: (state, action: PayloadAction<{ groupId: string; newOrder: string[] }>) => {
      const { groupId, newOrder } = action.payload;
      const group = state.groups.find(g => g.id === groupId);

      if (group) {
        group.items = newOrder;
        state.error = null;
      }
    },

    // 切换分组展开/折叠状态
    toggleGroupExpanded: (state, action: PayloadAction<string>) => {
      const groupId = action.payload;
      const group = state.groups.find(g => g.id === groupId);

      if (group) {
        group.expanded = !group.expanded;
        state.error = null;
      }
    }
  }
});

export const {
  loadGroupsSuccess,
  setError,
  clearError,
  setLoading,
  createGroup,
  updateGroup,
  deleteGroup,
  addItemToGroup,
  removeItemFromGroup,
  reorderGroups,
  reorderItemsInGroup,
  toggleGroupExpanded
} = groupsSlice.actions;

// 辅助选择器函数
export const selectTopicGroupsByAssistant = (state: { groups: GroupsState }, assistantId: string) => {
  return state.groups.groups
    .filter(group => group.type === 'topic' && group.assistantId === assistantId)
    .sort((a, b) => a.order - b.order);
};

export const selectTopicGroupMapByAssistant = (state: { groups: GroupsState }, assistantId: string) => {
  return state.groups.topicGroupMap[assistantId] || {};
};

export const selectAssistantGroups = (state: { groups: GroupsState }) => {
  return state.groups.groups
    .filter(group => group.type === 'assistant')
    .sort((a, b) => a.order - b.order);
};

// 异步初始化action
export const initGroups = () => async (dispatch: AppDispatch) => {
  dispatch(setLoading(true));
  try {
    await initializeGroups(dispatch);
    // 返回一个符合UnknownAction类型的对象
    return { type: 'groups/initGroups' };
  } catch (error) {
    dispatch(setError(error instanceof Error ? error.message : '初始化分组失败'));
    throw error;
  }
};

// 异步保存操作
export const saveGroups = () => async (_dispatch: AppDispatch, getState: () => RootState) => {
  try {
    const { groups, assistantGroupMap, topicGroupMap } = getState().groups;
    await saveGroupsToStorage(groups);
    await saveMapToStorage('assistantGroupMap', assistantGroupMap);
    await saveMapToStorage('topicGroupMap', topicGroupMap);
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('保存分组数据失败:', error);
    }
  }
};

export default groupsSlice.reducer;