import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  { files: ['api/**/*.js','server/**/*.js','scripts/**/*.{js,mjs}','tests/**/*.{js,mjs}'], languageOptions: { globals: globals.node } },
  {
    files: ['src/**/*.{js,jsx}'],
    ignores: ['src/utils/userTime.js'],
    rules: {
      'no-restricted-syntax': ['error',
        { selector: "NewExpression[callee.object.name='Intl'][callee.property.name='DateTimeFormat']", message: 'Use formatUserDateTime from utils/userTime.js to follow device settings.' },
        { selector: "CallExpression[callee.object.name='Intl'][callee.property.name='DateTimeFormat']", message: 'Device time settings belong in utils/userTime.js.' },
        { selector: "CallExpression[callee.property.name=/^toLocale(Date|Time)String$/]", message: 'Use formatUserDateTime for browser-visible dates and times.' },
        { selector: "Property[key.name=/^(timeZone|hourCycle|hour12)$/]", message: 'Do not override visitor timezone or clock preferences outside utils/userTime.js.' },
      ],
    },
  },
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
])
