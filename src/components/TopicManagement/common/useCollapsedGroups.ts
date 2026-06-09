import { useCallback, useMemo, useState } from 'react';

interface CollapsibleGroup {
  id: string;
  expanded?: boolean;
}

/**
 * 管理侧边栏分组的折叠/展开状态。
 *
 * 默认展开态来自 group.expanded（与旧 Accordion 的 defaultExpanded 一致），
 * 用户手动切换后以本地 override 为准（不持久化，行为等价于旧的非受控 Accordion）。
 */
export function useCollapsedGroups() {
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const isCollapsed = useCallback(
    (group: CollapsibleGroup) => overrides[group.id] ?? !group.expanded,
    [overrides]
  );

  const toggle = useCallback((id: string, currentlyCollapsed: boolean) => {
    setOverrides((prev) => ({ ...prev, [id]: !currentlyCollapsed }));
  }, []);

  return useMemo(() => ({ isCollapsed, toggle }), [isCollapsed, toggle]);
}
