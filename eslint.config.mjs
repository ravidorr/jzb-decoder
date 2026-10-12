import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const stylisticRules = {
  '@stylistic/indent': ['error', 4],
  '@stylistic/quotes': ['error', 'single'],
  '@stylistic/semi': ['error', 'always'],
  '@stylistic/space-before-function-paren': ['error', 'always'],
  '@stylistic/comma-dangle': ['error', 'never'],
  '@stylistic/array-bracket-spacing': ['error', 'always'],
  '@stylistic/object-curly-spacing': ['error', 'always']
};

export default tseslint.config(
  {
    ignores: [
      '.claude/**',
      'coverage/**',
      'dist/**',
      'node_modules/**',
      '.lighthouseci/**',
      'typecheck-globals.d.ts'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: globals.node
    },
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off'
    }
  },
  {
    files: ['jzb.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: globals.browser
    },
    plugins: {
      '@stylistic': stylistic
    },
    rules: stylisticRules
  },
  {
    files: ['devtools.js', 'panel.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        chrome: 'readonly',
        JzbDecoder: 'readonly'
      }
    },
    plugins: {
      '@stylistic': stylistic
    },
    rules: {
      ...stylisticRules,
      '@typescript-eslint/no-empty-function': 'off'
    }
  },
  {
    files: ['scripts/**/*.js', 'test/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: globals.node
    },
    plugins: {
      '@stylistic': stylistic
    },
    rules: {
      ...stylisticRules,
      'no-console': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-dynamic-delete': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-this-alias': 'off'
    }
  },
  {
    files: ['scripts/**/*.mjs', 'test/**/*.mjs', 'eslint.config.mjs'],
    languageOptions: {
      globals: globals.node
    },
    rules: {
      '@stylistic/array-bracket-spacing': 'off',
      '@stylistic/indent': 'off',
      '@stylistic/space-before-function-paren': 'off',
      'no-console': 'off'
    }
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    ...tseslint.configs.disableTypeChecked
  }
);
