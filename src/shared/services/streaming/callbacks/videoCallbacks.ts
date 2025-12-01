/**
 * 视频回调模块
 * 处理视频搜索和生成响应
 * 
 * 完全参考 Cherry Studio videoCallbacks 设计
 */

import { v4 as uuid } from 'uuid';
import { MessageBlockStatus, MessageBlockType } from '../../../types/newMessage';
import type { VideoMessageBlock, MessageBlock } from '../../../types/newMessage';
import type { BlockManager } from '../BlockManager';
import type { VideoSearchResult } from './types';

/**
 * 视频回调依赖
 */
interface VideoCallbacksDependencies {
  blockManager: BlockManager;
  assistantMsgId: string;
}

/**
 * 创建视频回调
 */
export const createVideoCallbacks = (deps: VideoCallbacksDependencies) => {
  const { assistantMsgId, blockManager } = deps;
  
  // 内部状态
  let videoBlockId: string | null = null;

  /**
   * 创建新的视频块
   */
  const createNewVideoBlock = (overrides: Partial<VideoMessageBlock> = {}): MessageBlock => {
    return {
      id: uuid(),
      messageId: assistantMsgId,
      type: MessageBlockType.VIDEO,
      url: '',
      mimeType: 'video/mp4',
      createdAt: new Date().toISOString(),
      status: MessageBlockStatus.PENDING,
      ...overrides
    } as VideoMessageBlock;
  };

  return {
    /**
     * 视频创建
     */
    onVideoCreated: async () => {
      console.log('[VideoCallbacks] 视频创建');
      
      if (blockManager.hasInitialPlaceholder && blockManager.initialPlaceholderBlockId) {
        // 复用占位符块
        videoBlockId = blockManager.initialPlaceholderBlockId;
        blockManager.smartBlockUpdate(
          videoBlockId,
          {
            type: MessageBlockType.VIDEO,
            status: MessageBlockStatus.PENDING
          },
          MessageBlockType.VIDEO,
          false
        );
      } else if (!videoBlockId) {
        // 创建新视频块
        const newBlock = createNewVideoBlock({ status: MessageBlockStatus.PENDING });
        videoBlockId = newBlock.id;
        await blockManager.handleBlockTransition(newBlock, MessageBlockType.VIDEO);
      }
    },

    /**
     * 视频增量更新
     */
    onVideoDelta: async (videoData: any) => {
      if (!videoBlockId) {
        const newBlock = createNewVideoBlock({ status: MessageBlockStatus.STREAMING });
        videoBlockId = newBlock.id;
        await blockManager.handleBlockTransition(newBlock, MessageBlockType.VIDEO);
      }
      
      const videoUrl = videoData?.url || videoData?.content || '';
      const changes: Partial<VideoMessageBlock> = {
        url: videoUrl,
        metadata: videoData?.metadata || {},
        status: MessageBlockStatus.STREAMING
      };
      
      blockManager.smartBlockUpdate(videoBlockId, changes, MessageBlockType.VIDEO, false);
    },

    /**
     * 视频完成
     */
    onVideoComplete: async (videoData?: any) => {
      console.log('[VideoCallbacks] 视频完成');
      
      if (videoBlockId) {
        const videoUrl = videoData?.url || videoData?.content || '';
        const changes: Partial<VideoMessageBlock> = {
          url: videoUrl,
          metadata: videoData?.metadata || {},
          status: MessageBlockStatus.SUCCESS
        };
        
        blockManager.smartBlockUpdate(videoBlockId, changes, MessageBlockType.VIDEO, true);
        videoBlockId = null;
      } else if (videoData) {
        const newBlock = createNewVideoBlock({
          url: videoData.url || videoData.content || '',
          metadata: videoData.metadata || {},
          status: MessageBlockStatus.SUCCESS
        });
        await blockManager.handleBlockTransition(newBlock, MessageBlockType.VIDEO);
      }
    },

    /**
     * 视频搜索结果
     */
    onVideoSearched: async (videos: VideoSearchResult[] | any) => {
      console.log('[VideoCallbacks] 视频搜索结果');
      
      // 处理单个视频对象的情况
      if (videos && !Array.isArray(videos)) {
        const video = videos as { type?: string; content?: string; url?: string; metadata?: any };
        
        if (!video.content && !video.url) {
          console.warn('[VideoCallbacks] onVideoSearched 调用但没有视频数据');
          return;
        }
        
        const newBlock = createNewVideoBlock({
          url: video.type === 'url' ? video.content : video.url || '',
          file: video.type === 'path' ? { 
            id: uuid(),
            name: video.content || '',
            origin_name: video.content || '',
            size: 0,
            mimeType: 'video/mp4'
          } : undefined,
          metadata: video.metadata || {},
          status: MessageBlockStatus.SUCCESS
        });
        
        await blockManager.handleBlockTransition(newBlock, MessageBlockType.VIDEO);
        return;
      }
      
      // 处理视频数组
      if (!videos || videos.length === 0) return;
      
      for (const video of videos) {
        const newBlock = createNewVideoBlock({
          url: video.url || '',
          metadata: {
            title: video.title,
            thumbnail: video.thumbnail,
            duration: video.duration
          },
          status: MessageBlockStatus.SUCCESS
        });
        
        await blockManager.handleBlockTransition(newBlock, MessageBlockType.VIDEO);
      }
    },

    // 暴露内部状态
    getCurrentVideoBlockId: () => videoBlockId,
    resetVideoBlock: () => {
      videoBlockId = null;
    }
  } as any;
}
