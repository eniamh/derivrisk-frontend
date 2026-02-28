import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // Ignore patterns
  {
    ignores: ['dist'],
  },

  // Main TypeScript + React config
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs['flat/recommended'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // ────────────────────────────────────────────────
      // Change no-explicit-any from error → warning
      '@typescript-eslint/no-explicit-any': 'warn',
      // ────────────────────────────────────────────────
      
      // You can add other custom rules here later if needed
      // e.g.:
      // '@typescript-eslint/no-unused-vars': 'warn',
    },
  }
)