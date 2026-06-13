import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'android/**', 'docs/**', 'Capacitor-CORS2/**', 'src-tauri/**'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-require-imports': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-case-declarations': 'off',
      'no-dupe-else-if': 'off',
      'no-async-promise-executor': 'off',
      'prefer-const': 'off',
      'no-control-regex': 'error',
      // 引导新代码改用统一 logger；现存裸 console 仅告警、不阻断（迁移完成后再升级为 error）
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // 日志基础设施本身必须直接使用 console
    files: [
      'src/shared/services/infra/logger/**/*.{ts,tsx}',
      'src/shared/services/infra/EnhancedConsoleService.ts',
      'src/shared/services/infra/LoggerService.ts',
      'src/shared/utils/debugLogger.ts',
    ],
    rules: {
      'no-console': 'off',
    },
  },
)
