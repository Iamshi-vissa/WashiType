import js from '@eslint/js';
import globals from 'globals';
import eslintReact from '@eslint-react/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';

// ESLint 10 tracks names used in JSX itself, so a component used only in JSX counts as used
// (eslint-plugin-react's jsx-uses-vars did this before; it doesn't support ESLint 10).
// From @eslint-react, only rules that catch real bugs are on, matching what
// eslint-plugin-react's recommended set checked; its style and React 19 migration rules
// would mostly flag the copied ReactBits files, which are kept as close to upstream as possible.
const reactRules = Object.fromEntries(
  [
    'no-missing-key',
    'no-duplicate-key',
    'jsx-no-children-prop',
    'jsx-no-children-prop-with-children',
    'jsx-no-comment-textnodes',
    'jsx-no-key-after-spread',
    'jsx-no-leaked-semicolon',
    'no-direct-mutation-state',
    'no-nested-component-definitions',
    'dom-no-unsafe-target-blank',
    'dom-no-dangerously-set-innerhtml-with-children',
    'dom-no-void-elements-with-children',
    'dom-no-unknown-property',
    'dom-no-find-dom-node',
    'dom-no-render-return-value',
    'dom-no-script-url'
  ].map(rule => [`@eslint-react/${rule}`, 'error'])
);

export default [
  { ignores: ['dist', 'node_modules', 'test-results', 'playwright-report'] },
  {
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node, __RELEASE__: 'readonly' },
      parserOptions: { ecmaFeatures: { jsx: true } }
    },
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    plugins: { '@eslint-react': eslintReact, 'react-hooks': reactHooks },
    rules: {
      ...js.configs.recommended.rules,
      ...reactRules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // ReactBits components use empty catch blocks on purpose (e.g. releasing pointer capture).
      'no-empty': ['error', { allowEmptyCatch: true }]
    }
  }
];
