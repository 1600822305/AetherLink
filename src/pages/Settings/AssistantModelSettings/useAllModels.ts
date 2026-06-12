import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../../shared/store';
import type { Model } from '../../../shared/types';

export interface ModelWithProvider extends Model {
  providerName: string;
  providerId: string;
}

/** 所有已启用供应商中的可用模型 */
export function useAllModels(): ModelWithProvider[] {
  const providers = useSelector((state: RootState) => state.settings.providers || []);

  return useMemo(() => (
    providers
      .filter((provider) => provider.isEnabled)
      .flatMap((provider) =>
        (provider.models || [])
          .filter((model) => model.enabled)
          .map((model) => ({
            ...model,
            providerName: provider.name,
            providerId: provider.id,
          }))
      )
  ), [providers]);
}
