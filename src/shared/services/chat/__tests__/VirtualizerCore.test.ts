import { describe, it, expect } from 'vitest';
import { VirtualizerCore } from '../virtualizer/VirtualizerCore';

/** 固定估高，便于断言几何 */
const fixed = (h: number) => () => h;

describe('VirtualizerCore', () => {
  describe('基础几何（全估高）', () => {
    it('getOffset / totalSize 在等高下线性', () => {
      const v = new VirtualizerCore({ count: 10, estimateSize: fixed(100) });
      expect(v.getOffset(0)).toBe(0);
      expect(v.getOffset(3)).toBe(300);
      expect(v.getOffset(10)).toBe(1000); // getOffset(count) = 总高
      expect(v.totalSize()).toBe(1000);
    });

    it('getOffset 越界被 clamp 到 [0, count]', () => {
      const v = new VirtualizerCore({ count: 5, estimateSize: fixed(50) });
      expect(v.getOffset(-3)).toBe(0);
      expect(v.getOffset(999)).toBe(250);
    });
  });

  describe('getRange 窗口计算', () => {
    it('顶部：scrollTop=0 时从 0 开始，padTop=0', () => {
      const v = new VirtualizerCore({ count: 100, estimateSize: fixed(100), overscanPx: 0 });
      const r = v.getRange(0, 500);
      expect(r.startIndex).toBe(0);
      expect(r.padTop).toBe(0);
      // 视口 500 / 每条 100 => 渲染到第 5 条（含），endIndex=5
      expect(r.endIndex).toBe(5);
      expect(r.padBottom).toBe(v.totalSize() - v.getOffset(r.endIndex + 1));
    });

    it('中部：padTop + 渲染高度 + padBottom == 总高', () => {
      const v = new VirtualizerCore({ count: 100, estimateSize: fixed(100), overscanPx: 0 });
      const r = v.getRange(2500, 500);
      const renderedHeight = v.getOffset(r.endIndex + 1) - v.getOffset(r.startIndex);
      expect(r.padTop + renderedHeight + r.padBottom).toBe(v.totalSize());
      expect(r.startIndex).toBe(25);
    });

    it('overscan 会向上下各扩展渲染范围', () => {
      const noOver = new VirtualizerCore({ count: 100, estimateSize: fixed(100), overscanPx: 0 });
      const withOver = new VirtualizerCore({ count: 100, estimateSize: fixed(100), overscanPx: 300 });
      const a = noOver.getRange(2500, 500);
      const b = withOver.getRange(2500, 500);
      expect(b.startIndex).toBeLessThan(a.startIndex);
      expect(b.endIndex).toBeGreaterThan(a.endIndex);
    });

    it('底部：endIndex 不超过最后一条', () => {
      const v = new VirtualizerCore({ count: 20, estimateSize: fixed(100), overscanPx: 0 });
      const r = v.getRange(v.totalSize(), 500);
      expect(r.endIndex).toBe(19);
      expect(r.padBottom).toBe(0);
    });

    it('空列表返回 endIndex=-1、零占位', () => {
      const v = new VirtualizerCore({ count: 0, estimateSize: fixed(100) });
      const r = v.getRange(0, 500);
      expect(r).toEqual({ startIndex: 0, endIndex: -1, padTop: 0, padBottom: 0 });
    });
  });

  describe('实测高度', () => {
    it('setMeasured 改变后影响偏移，且仅在值变化时返回 true', () => {
      const v = new VirtualizerCore({ count: 5, estimateSize: fixed(100) });
      expect(v.setMeasured(0, 250)).toBe(true);
      expect(v.setMeasured(0, 250)).toBe(false); // 相同值不触发
      expect(v.getOffset(1)).toBe(250);
      expect(v.totalSize()).toBe(250 + 100 * 4);
    });

    it('越界 setMeasured 被忽略', () => {
      const v = new VirtualizerCore({ count: 3, estimateSize: fixed(100) });
      expect(v.setMeasured(5, 999)).toBe(false);
      expect(v.totalSize()).toBe(300);
    });

    it('invalidate 回退到估高', () => {
      const v = new VirtualizerCore({ count: 3, estimateSize: fixed(100) });
      v.setMeasured(1, 400);
      expect(v.totalSize()).toBe(600);
      v.invalidate(1);
      expect(v.totalSize()).toBe(300);
    });

    it('clearMeasurements 全部回退估高', () => {
      const v = new VirtualizerCore({ count: 3, estimateSize: fixed(100) });
      v.setMeasured(0, 200);
      v.setMeasured(2, 200);
      v.clearMeasurements();
      expect(v.totalSize()).toBe(300);
    });
  });

  describe('数量变更', () => {
    it('append 增加尾部，保留既有实测值', () => {
      const v = new VirtualizerCore({ count: 3, estimateSize: fixed(100) });
      v.setMeasured(0, 250);
      v.append(2);
      expect(v.getCount()).toBe(5);
      expect(v.getOffset(1)).toBe(250); // 头部实测值不受影响
      expect(v.totalSize()).toBe(250 + 100 * 4);
    });

    it('setCount 收缩时清除越界实测值', () => {
      const v = new VirtualizerCore({ count: 5, estimateSize: fixed(100) });
      v.setMeasured(4, 500);
      v.setCount(3);
      expect(v.getCount()).toBe(3);
      expect(v.totalSize()).toBe(300); // index4 的实测值已被清除
    });

    it('prepend 把既有实测值整体后移', () => {
      const v = new VirtualizerCore({ count: 3, estimateSize: fixed(100) });
      v.setMeasured(0, 250); // 原第 0 条高 250
      v.prepend(2); // 头部插入 2 条
      expect(v.getCount()).toBe(5);
      // 原第 0 条现在是第 2 条，应仍为 250；新插入的 0、1 为估高 100
      expect(v.sizeOf(0)).toBe(100);
      expect(v.sizeOf(2)).toBe(250);
      expect(v.totalSize()).toBe(100 + 100 + 250 + 100 + 100);
    });
  });

  describe('滚动锚点（防跳）', () => {
    it('captureAnchor 锚定视口顶部条目及内部偏移', () => {
      const v = new VirtualizerCore({ count: 100, estimateSize: fixed(100) });
      const a = v.captureAnchor(2530);
      expect(a.index).toBe(25);
      expect(a.offset).toBe(30);
      expect(v.resolveScrollTop(a)).toBe(2530);
    });

    it('上方条目实测变高后，按锚点解析出的 scrollTop 抵消位移', () => {
      const v = new VirtualizerCore({ count: 100, estimateSize: fixed(100) });
      const scrollTop = 2530; // 视口顶在第 25 条内 30px 处
      const anchor = v.captureAnchor(scrollTop);
      // 第 10 条（在视口上方）实测从 100 变成 300，上方多出 200px
      v.setMeasured(10, 300);
      const corrected = v.resolveScrollTop(anchor);
      expect(corrected).toBe(scrollTop + 200); // 下移 200 抵消，视口内容不跳
    });

    it('prepend 历史后，配合锚点 index 偏移可保持视口', () => {
      const v = new VirtualizerCore({ count: 100, estimateSize: fixed(100) });
      const scrollTop = 2530;
      const anchor = v.captureAnchor(scrollTop);
      v.prepend(5); // 头部插入 5 条估高 100 => 上方多 500
      const corrected = v.resolveScrollTop({ index: anchor.index + 5, offset: anchor.offset });
      expect(corrected).toBe(scrollTop + 500);
    });
  });

  describe('变高混合场景', () => {
    it('混合实测/估高下前缀和一致', () => {
      const v = new VirtualizerCore({ count: 6, estimateSize: fixed(100), overscanPx: 0 });
      v.setMeasured(1, 50);
      v.setMeasured(3, 200);
      // 高度序列: 100,50,100,200,100,100 => 前缀: 0,100,150,250,450,550,650
      expect(v.getOffset(0)).toBe(0);
      expect(v.getOffset(2)).toBe(150);
      expect(v.getOffset(4)).toBe(450);
      expect(v.totalSize()).toBe(650);
      const r = v.getRange(150, 100);
      expect(r.startIndex).toBe(2); // offset150 落在第 2 条顶部
    });
  });
});
