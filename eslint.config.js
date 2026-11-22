import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    plugins: {
      import: importPlugin,
    },
    languageOptions: {
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    settings: {
      // Детерминированная классификация "@/..." путей как internal независимо
      // от рабочей папки запуска: без этого eslint из корня и из apps/web
      // по-разному сортируют импорты и --fix отменяет сам себя в lint-staged
      'import/internal-regex': '^@/',
      'import/resolver': {
        typescript: true,
        node: true,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'type'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import/no-duplicates': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
    ignores: ['node_modules', 'dist', '.next', '*.config.js', '*.config.mjs'],
  }
);
