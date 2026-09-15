import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', 'app/**', 'components/**', 'hooks/**', 'lib/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['frontend/src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['backend/src/**/*.ts', 'backend/test/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
);
