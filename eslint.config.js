const js = require('@eslint/js');
const globals = require('globals');
module.exports = [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      'playwright-report/**',
      'test-results/**',
      '.codex/**',
    ],
  },
  js.configs.recommended,
  // Prettier can wrap Supertest's computed method chains across lines.
  { files: ['apps/api/test/**/*.js'], rules: { 'no-unexpected-multiline': 'off' } },
  { rules: { 'no-useless-catch': 'off' } },
  {
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_|^[A-Z]|^onNodesChange$|^onEdgesChange$|^load$',
          caughtErrors: 'none',
          ignoreRestSiblings: true,
        },
      ],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
];
