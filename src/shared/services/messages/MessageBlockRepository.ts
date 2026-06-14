import store from '../../store';
import { dexieStorage } from '../storage/DexieStorageService';
import { newMessagesActions } from '../../store/slices/newMessagesSlice';
import { addOneBlock, updateOneBlock } from '../../store/slices/messageBlocksSlice';
import {
  MessageBlockStatus,
  MessageBlockType,
  isTerminalBlockStatus
} from '../../types/newMessage';
import type { Message, MessageBlock, ThinkingMessageBlock } from '../../types/newMessage';
import { createLogger } from '../infra/logger';
const logger = createLogger('MessageBlockRepository');

export type BlockAttachPosition =
  | { type: 'append' }
  | { type: 'prepend' }
  | { type: 'before'; anchorBlockId: string }
  | { type: 'after'; anchorBlockId: string };

export interface CreateBlockAndAttachOptions {
  position?: BlockAttachPosition;
}

export interface FinalizeMessageBlocksOptions {
  now: string;
  thinkingDurationMs?: number;
  skipBlockIds?: Iterable<string>;
}

function insertBlockId(
  currentBlocks: string[],
  blockId: string,
  position: BlockAttachPosition = { type: 'append' }
): string[] {
  const withoutDuplicate = currentBlocks.filter(id => id !== blockId);

  if (position.type === 'prepend') {
    return [blockId, ...withoutDuplicate];
  }

  if (position.type === 'before' || position.type === 'after') {
    const anchorIndex = withoutDuplicate.indexOf(position.anchorBlockId);
    if (anchorIndex !== -1) {
      const insertIndex = position.type === 'before' ? anchorIndex : anchorIndex + 1;
      return [
        ...withoutDuplicate.slice(0, insertIndex),
        blockId,
        ...withoutDuplicate.slice(insertIndex)
      ];
    }
  }

  return [...withoutDuplicate, blockId];
}

function resolveThinkingMillis(
  block: ThinkingMessageBlock,
  thinkingDurationMs: number | undefined,
  now: string
): number {
  if (typeof block.thinking_millsec === 'number' && block.thinking_millsec > 0) {
    return block.thinking_millsec;
  }
  if (typeof thinkingDurationMs === 'number' && thinkingDurationMs > 0) {
    return thinkingDurationMs;
  }
  const start = block.thinkingStartTime ?? Date.parse(block.createdAt);
  const end = Date.parse(now);
  if (!Number.isNaN(start) && !Number.isNaN(end)) {
    return Math.max(0, end - start);
  }
  return 0;
}

function isTerminalStatusRevert(block: MessageBlock | undefined, changes: Partial<MessageBlock>): boolean {
  if (!block || changes.status === undefined) return false;
  return isTerminalBlockStatus(block.status) && !isTerminalBlockStatus(changes.status);
}

function toReduxPosition(position: BlockAttachPosition = { type: 'append' }) {
  if (position.type === 'before' || position.type === 'after') {
    return {
      position: position.type,
      anchorBlockId: position.anchorBlockId
    };
  }
  return { position: position.type };
}

export class MessageBlockRepository {
  async createBlockAndAttach(
    block: MessageBlock,
    options: CreateBlockAndAttachOptions = {}
  ): Promise<string[]> {
    const position = options.position ?? { type: 'append' };
    const updatedBlocks = await this.persistBlockAndMessageReference(block, position);

    store.dispatch(addOneBlock(block));
    store.dispatch(newMessagesActions.insertBlockReference({
      messageId: block.messageId,
      blockId: block.id,
      ...toReduxPosition(position)
    }));

    return updatedBlocks;
  }

  async updateBlock(blockId: string, changes: Partial<MessageBlock>): Promise<boolean> {
    const currentBlock = await this.getLatestBlock(blockId);
    if (isTerminalStatusRevert(currentBlock, changes)) {
      return false;
    }

    store.dispatch(updateOneBlock({ id: blockId, changes }));
    await dexieStorage.updateMessageBlock(blockId, changes);
    return true;
  }

  async insertBlockBefore(messageId: string, blockId: string, anchorBlockId: string): Promise<string[]> {
    return this.insertExistingBlock(messageId, blockId, { type: 'before', anchorBlockId });
  }

  async insertBlockAfter(messageId: string, blockId: string, anchorBlockId: string): Promise<string[]> {
    return this.insertExistingBlock(messageId, blockId, { type: 'after', anchorBlockId });
  }

  async finalizeMessageBlocks(
    messageId: string,
    options: FinalizeMessageBlocksOptions
  ): Promise<number> {
    const { now, thinkingDurationMs } = options;
    const skip = new Set(options.skipBlockIds ?? []);
    const message = store.getState().messages.entities[messageId];
    const blockIds = message?.blocks ?? [];
    const updates: Array<Promise<boolean>> = [];
    let finalized = 0;

    for (const id of blockIds) {
      if (skip.has(id)) continue;

      const block = store.getState().messageBlocks.entities[id];
      if (!block || isTerminalBlockStatus(block.status)) continue;

      const changes: Partial<MessageBlock> = {
        status: MessageBlockStatus.SUCCESS,
        updatedAt: now
      };

      if (block.type === MessageBlockType.THINKING) {
        changes.thinking_millsec = resolveThinkingMillis(block, thinkingDurationMs, now);
      }

      updates.push(this.updateBlock(id, changes));
      finalized++;
    }

    if (updates.length > 0) {
      await Promise.all(updates);
    }

    if (finalized > 0) {
      logger.debug(`收尾非终态块 ${finalized} 个 - 消息ID: ${messageId}`);
    }

    return finalized;
  }

  private async insertExistingBlock(
    messageId: string,
    blockId: string,
    position: BlockAttachPosition
  ): Promise<string[]> {
    const updatedBlocks = await this.persistMessageReference(messageId, blockId, position);

    store.dispatch(newMessagesActions.insertBlockReference({
      messageId,
      blockId,
      ...toReduxPosition(position)
    }));

    return updatedBlocks;
  }

  private async persistBlockAndMessageReference(
    block: MessageBlock,
    position: BlockAttachPosition
  ): Promise<string[]> {
    let updatedBlocks: string[] = [];

    await dexieStorage.transaction('rw', [
      dexieStorage.message_blocks,
      dexieStorage.messages
    ], async () => {
      await dexieStorage.saveMessageBlock(block);
      updatedBlocks = await this.persistMessageReferenceWithoutTransaction(block.messageId, block.id, position);
    });

    return updatedBlocks;
  }

  private async persistMessageReference(
    messageId: string,
    blockId: string,
    position: BlockAttachPosition
  ): Promise<string[]> {
    let updatedBlocks: string[] = [];

    await dexieStorage.transaction('rw', [dexieStorage.messages], async () => {
      updatedBlocks = await this.persistMessageReferenceWithoutTransaction(messageId, blockId, position);
    });

    return updatedBlocks;
  }

  private async persistMessageReferenceWithoutTransaction(
    messageId: string,
    blockId: string,
    position: BlockAttachPosition
  ): Promise<string[]> {
    const message = await this.getLatestMessage(messageId);
    if (!message) {
      return [];
    }

    const updatedBlocks = insertBlockId(message.blocks ?? [], blockId, position);
    await dexieStorage.updateMessage(messageId, {
      blocks: updatedBlocks,
      updatedAt: new Date().toISOString()
    });
    return updatedBlocks;
  }

  private async getLatestMessage(messageId: string): Promise<Message | undefined> {
    const dbMessage = await dexieStorage.getMessage(messageId);
    if (dbMessage) return dbMessage;
    return store.getState().messages.entities[messageId];
  }

  private async getLatestBlock(blockId: string): Promise<MessageBlock | undefined> {
    const stateBlock = store.getState().messageBlocks.entities[blockId];
    if (stateBlock) return stateBlock;

    const dbBlock = await dexieStorage.getMessageBlock(blockId);
    return dbBlock ?? undefined;
  }
}

export const messageBlockRepository = new MessageBlockRepository();
