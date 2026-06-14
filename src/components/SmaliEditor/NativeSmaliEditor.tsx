import React, { useEffect, useRef } from 'react';
import { DexEditorPlugin } from 'capacitor-dex-editor';
import { Capacitor } from '@capacitor/core';
import { createLogger } from '../../shared/services/infra/logger';

const logger = createLogger('NativeSmaliEditor');

interface NativeSmaliEditorProps {
  open: boolean;
  onClose: () => void;
  initialContent: string;
  onSave?: (newContent: string) => void;
  title?: string;
  className?: string;
  readOnly?: boolean;
}

/**
 * 原生 Smali 编辑器组件
 * 调用 MH-TextEditor 原生实现
 */
const NativeSmaliEditor: React.FC<NativeSmaliEditorProps> = ({
  open,
  onClose,
  initialContent,
  onSave,
  title = 'Smali Editor',
  className,
  readOnly = false,
}) => {
  const isOpeningRef = useRef(false);
  const propsRef = useRef({ initialContent, title, className, readOnly, onSave, onClose });
  
  // 更新 ref
  propsRef.current = { initialContent, title, className, readOnly, onSave, onClose };

  useEffect(() => {
    if (!open || isOpeningRef.current) return;
    
    const openNativeEditor = async () => {
      if (!Capacitor.isNativePlatform()) {
        logger.warn('Native editor only available on Android');
        propsRef.current.onClose();
        return;
      }

      isOpeningRef.current = true;
      logger.debug('Opening native editor...');

      try {
        const result = await DexEditorPlugin.openSmaliEditor({
          content: propsRef.current.initialContent,
          title: propsRef.current.title || 'Smali Editor',
          className: propsRef.current.className || '',
          readOnly: propsRef.current.readOnly || false,
        });

        logger.debug('Result:', result);

        if (result.success && result.modified && propsRef.current.onSave && result.content) {
          await propsRef.current.onSave(result.content);
        }
      } catch (error) {
        logger.error('Failed to open native editor:', error);
      } finally {
        isOpeningRef.current = false;
        propsRef.current.onClose();
      }
    };

    openNativeEditor();
  }, [open]);

  // 原生编辑器不需要渲染任何 UI
  return null;
};

export default NativeSmaliEditor;
