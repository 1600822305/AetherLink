import React from 'react';
import {
  Code as CodeIcon,
  Image as ImageIcon,
  FileText as PdfIcon,
  FileText as TextIcon,
  Eye as ViewIcon
} from 'lucide-react';
import type { FileType } from '../types';

interface FileIconProps {
  type: FileType;
}

export const FileIcon: React.FC<FileIconProps> = ({ type }) => {
  switch (type) {
    case 'text':
      return <TextIcon />;
    case 'image':
      return <ImageIcon />;
    case 'code':
      return <CodeIcon />;
    case 'pdf':
      return <PdfIcon />;
    default:
      return <ViewIcon />;
  }
};
