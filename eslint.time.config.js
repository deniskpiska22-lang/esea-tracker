import config from './eslint.config.js';
import reactRefresh from 'eslint-plugin-react-refresh';
import reactHooks from 'eslint-plugin-react-hooks';
// Reuse the production policy; normal lint still reports unrelated findings.
export default [
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { 'react-refresh': reactRefresh, 'react-hooks': reactHooks },
    linterOptions: { reportUnusedDisableDirectives: 'off' },
  },
  config.find(entry => entry.rules?.['no-restricted-syntax']),
];
