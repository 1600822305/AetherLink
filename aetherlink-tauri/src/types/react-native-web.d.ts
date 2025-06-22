declare module 'react-native-web' {
  import * as React from 'react';

  export interface TextInputProps {
    style?: any;
    value?: string;
    onChangeText?: (text: string) => void;
    multiline?: boolean;
    numberOfLines?: number;
    maxLength?: number;
    onKeyPress?: (e: any) => void;
    disabled?: boolean;
    placeholder?: string;
    autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
    autoCorrect?: boolean;
    spellCheck?: boolean;
    contextMenuHidden?: boolean;
    selectionColor?: string;
    keyboardType?: string;
    textContentType?: string;
    autoCompleteType?: string;
    dataDetectorTypes?: string | string[];
    allowFontScaling?: boolean;
    caretHidden?: boolean;
    className?: string;
    ref?: React.RefObject<any>;
  }

  export class TextInput extends React.Component<TextInputProps> {}
} 