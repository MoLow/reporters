'use strict';

module.exports = {
  env: {
    commonjs: true,
    es2021: true,
    node: true,
  },
  extends: 'airbnb-base',
  overrides: [
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'script',
  },
  rules: {
    'no-restricted-syntax': ['error', 'ForInStatement', 'LabeledStatement', 'WithStatement'],
    'capitalized-comments': ['error', 'always', { ignoreConsecutiveComments: true, ignorePattern: 'c8 ignore' }],
    strict: ['error', 'safe'],
  },
};
