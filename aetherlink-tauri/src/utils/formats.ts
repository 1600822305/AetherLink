/**
 * 转义括号处理
 */
export function escapeBrackets(text: string): string {
  const pattern = /(```[\s\S]*?```|`.*?`)|\\\[([\s\S]*?[^\\])\\]|\\\((.*?)\\\)/g;
  return text.replace(pattern, (match, codeBlock, squareBracket, roundBracket) => {
    if (codeBlock) {
      return codeBlock;
    } else if (squareBracket) {
      return `\n$$\n${squareBracket}\n$$\n`;
    } else if (roundBracket) {
      return `$${roundBracket}$`;
    }
    return match;
  });
}

/**
 * 移除SVG空行处理
 */
export function removeSvgEmptyLines(text: string): string {
  const svgPattern = /(<svg[\s\S]*?<\/svg>)/g;
  return text.replace(svgPattern, (svgMatch) => {
    return svgMatch
      .split('\n')
      .filter((line) => line.trim() !== '')
      .join('\n');
  });
}

/**
 * 转换数学公式格式
 */
export function convertMathFormula(text: string): string {
  // 将 \[ \] 转换为 $$ $$
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, '\n$$\n$1\n$$\n');

  // 将 \( \) 转换为 $ $
  text = text.replace(/\\\((.*?)\\\)/g, '$$$1$$');

  return text;
}

/**
 * 移除文件名中的特殊字符
 */
export function removeSpecialCharactersForFileName(fileName: string): string {
  // 移除或替换不安全的文件名字符
  let result = fileName
    .replace(/[<>:"/\\|?*]/g, '') // 移除Windows不允许的字符
    .replace(/^\.+/, '') // 移除开头的点
    .replace(/\.+$/, '') // 移除结尾的点
    .replace(/\s+/g, ' ') // 将多个空格替换为单个空格
    .trim(); // 移除前后空格

  // 移除控制字符（避免ESLint警告）
  result = (result || '').split('').filter(char => {
    const code = char.charCodeAt(0);
    return code >= 32 && code !== 127 && (code < 128 || code > 159);
  }).join('');

  return result.slice(0, 100) || 'Untitled'; // 限制长度并提供默认名称
}
