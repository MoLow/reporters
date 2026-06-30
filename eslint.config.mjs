import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({
  baseDirectory: path.dirname(fileURLToPath(import.meta.url)),
});

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/.snapshots/**',
      '**/coverage/**',
      '**/dist/**',
      '.yarn/**',
      'tests/snap.mjs',
      // TypeScript packages are type-checked via their tsup build (tsc dts).
      'packages/tree-core/**',
      'packages/live/**',
      'packages/web/**',
    ],
  },
  ...compat.extends('airbnb-base'),
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        setImmediate: 'readonly',
        clearTimeout: 'readonly',
        URL: 'readonly',
        Symbol: 'readonly',
      },
    },
    rules: {
      'no-restricted-syntax': ['error', 'ForInStatement', 'LabeledStatement', 'WithStatement'],
      'capitalized-comments': ['error', 'always', { ignoreConsecutiveComments: true, ignorePattern: 'c8 ignore' }],
      strict: ['error', 'safe'],
      'import/extensions': ['error', 'ignorePackages'],
      'import/no-relative-packages': 'off',
      'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
    },
  },
  {
    files: [
      'scripts/**/*.js',
      'tests/**/*.js',
      'packages/bail/tests/fixtures/**/*.js',
      'packages/testwatch/tests/fixtures/**/*.js',
      'packages/mocha/tests/{customReporter,emptySuiteReporter,progressiveReporter}/**/*.js',
    ],
    languageOptions: {
      sourceType: 'commonjs',
    },
  },
  {
    files: ['packages/mocha/index.js'],
    rules: {
      'max-classes-per-file': 'off',
    },
  },
];
