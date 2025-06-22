import React from 'react';
import type { SearchResultsMessageBlock } from '../../../shared/types/newMessage';
import SearchResultsCollapsible from '../../SearchResultsCollapsible';

interface Props {
  block: SearchResultsMessageBlock;
}

/**
 * 搜索结果块组件
 * 渲染搜索结果的折叠UI
 */
const SearchResultsBlock: React.FC<Props> = ({ block }) => {
  if (!block.searchResults || block.searchResults.length === 0) {
    return null;
  }

  return (
    <SearchResultsCollapsible
      results={block.searchResults}
      query={block.query}
    />
  );
};

export default React.memo(SearchResultsBlock);
