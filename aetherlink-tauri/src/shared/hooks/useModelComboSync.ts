import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { updateModelComboModels } from '../store/settingsSlice';
import { modelComboService } from '../services/ModelComboService';
import { EventEmitter, EVENT_NAMES } from '../services/EventEmitter';

/**
 * Hook用于同步模型组合到Redux store
 * 将模型组合作为虚拟模型添加到"模型组合"供应商中
 */
export const useModelComboSync = () => {
  const dispatch = useDispatch();

  const syncModelCombos = async () => {
    try {
      const combos = await modelComboService.getAllCombos();

      // 将模型组合转换为模型格式
      const comboModels = combos
        .filter(combo => combo.enabled)
        .map(combo => ({
          id: combo.id,
          name: combo.name,
          provider: 'model-combo',
          enabled: true,
          isDefault: false,
          description: combo.description,
          strategy: combo.strategy,
          modelCount: combo.models.length,
          // 添加特殊标识
          isCombo: true,
          comboConfig: combo
        }));

      // 更新Redux store
      dispatch(updateModelComboModels(comboModels));
    } catch (error) {
      console.error('[useModelComboSync] 同步模型组合失败:', error);
    }
  };

  useEffect(() => {
    // 初始同步
    syncModelCombos();

    // 监听模型组合变化事件
    const handleComboChange = () => {
      syncModelCombos();
    };

    EventEmitter.on(EVENT_NAMES.MODEL_COMBO_CREATED, handleComboChange);
    EventEmitter.on(EVENT_NAMES.MODEL_COMBO_UPDATED, handleComboChange);
    EventEmitter.on(EVENT_NAMES.MODEL_COMBO_DELETED, handleComboChange);

    // 清理事件监听器
    return () => {
      EventEmitter.off(EVENT_NAMES.MODEL_COMBO_CREATED, handleComboChange);
      EventEmitter.off(EVENT_NAMES.MODEL_COMBO_UPDATED, handleComboChange);
      EventEmitter.off(EVENT_NAMES.MODEL_COMBO_DELETED, handleComboChange);
    };
  }, [dispatch, syncModelCombos]);

  return { syncModelCombos };
};
