/**
 * Provider Hooks
 * 封装 Provider 状态管理的 React Hooks
 */
import { useCallback, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import type { Provider } from '../types';
import {
  selectAllProviders,
  selectEnabledProviders,
  selectProviderById,
  selectDefaultProvider,
  selectProvidersLoading,
  selectProvidersError,
  addProvider,
  updateProvider,
  removeProvider,
  toggleProvider,
  setDefaultProvider,
  fetchProviderModels,
  testProviderConnection,
  type ProvidersState,
} from '../../store/slices/providersSlice';

// ==================== useProviders ====================

/**
 * Provider 列表管理 Hook
 */
export function useProviders() {
  const dispatch = useAppDispatch();

  const providers = useAppSelector(selectAllProviders);
  const enabledProviders = useAppSelector(selectEnabledProviders);
  const defaultProvider = useAppSelector(selectDefaultProvider);
  const loading = useAppSelector(selectProvidersLoading);
  const error = useAppSelector(selectProvidersError);

  const actions = useMemo(() => ({
    add: (provider: Provider) => dispatch(addProvider(provider)),
    update: (provider: Partial<Provider> & { id: string }) => dispatch(updateProvider(provider)),
    remove: (id: string) => dispatch(removeProvider(id)),
    toggle: (id: string) => dispatch(toggleProvider(id)),
    setDefault: (id: string) => dispatch(setDefaultProvider(id)),
    fetchModels: (id: string) => dispatch(fetchProviderModels(id)),
    testConnection: (id: string) => dispatch(testProviderConnection(id)),
  }), [dispatch]);

  return {
    providers,
    enabledProviders,
    defaultProvider,
    loading,
    error,
    ...actions,
  };
}

// ==================== useProvider ====================

/**
 * 单个 Provider 管理 Hook
 */
export function useProvider(providerId: string) {
  const dispatch = useAppDispatch();

  const provider = useAppSelector((state: { providers: ProvidersState }) =>
    selectProviderById(state, providerId)
  );
  const loading = useAppSelector(selectProvidersLoading);

  const update = useCallback((changes: Partial<Provider>) => {
    dispatch(updateProvider({ id: providerId, ...changes }));
  }, [dispatch, providerId]);

  const toggle = useCallback(() => {
    dispatch(toggleProvider(providerId));
  }, [dispatch, providerId]);

  const fetchModels = useCallback(() => {
    return dispatch(fetchProviderModels(providerId));
  }, [dispatch, providerId]);

  const testConnection = useCallback(() => {
    return dispatch(testProviderConnection(providerId));
  }, [dispatch, providerId]);

  return {
    provider,
    loading,
    update,
    toggle,
    fetchModels,
    testConnection,
  };
}

// ==================== useProviderApi ====================

/**
 * Provider API Hook
 * 用于获取 API 客户端
 */
export function useProviderApi(providerId?: string) {
  const { defaultProvider } = useProviders();
  const specificProvider = useAppSelector((state: { providers: ProvidersState }) =>
    providerId ? selectProviderById(state, providerId) : undefined
  );

  const targetProvider = specificProvider || defaultProvider;

  const getClient = useCallback(async () => {
    if (!targetProvider) {
      throw new Error('No provider available');
    }

    const { ApiClientFactory, initializeDefaultClients } = await import('../clients');
    await initializeDefaultClients();

    return ApiClientFactory.create(targetProvider);
  }, [targetProvider]);

  return {
    provider: targetProvider,
    getClient,
  };
}
