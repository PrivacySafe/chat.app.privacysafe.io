/* eslint-disable */
module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
  },
  extends: [
    'plugin:vue/base',
    'plugin:vue/essential',
    'plugin:vue/vue3-recommended',
    '@vue/typescript/recommended',
  ],
  plugins: [
    'vue',
    '@typescript-eslint',
  ],
  parserOptions: {
    parser: '@typescript-eslint/parser',
    ecmaVersion: 2020,
  },
  rules: {
    'max-len': [
      'error',
      {
        code: 120,
        ignoreComments: true,
        ignoreUrls: true,
        ignoreStrings: true,
        ignoreRegExpLiterals: true,
      },
    ],
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-undef': 'off',
    'import/prefer-default-export': 'off',
    'default-case': 'off',
    'lines-between-class-members': 'off',
    'no-param-reassign': 'off',
    'no-return-assign': 'off',
    'arrow-parens': ['error', 'as-needed'],
    'object-curly-newline': ['error', { 'consistent': true }],

    '@typescript-eslint/no-inferrable-types': [
      'error',
      { ignoreProperties: false, ignoreParameters: false },
    ],
    '@typescript-eslint/naming-convention': [
      'error',
      { selector: 'interface', format: ['PascalCase'] },
    ],
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/ban-ts-comment': 'off',

    'vue/no-v-model-argument': 'off',
    'vue/multi-word-component-names': 'off',
    'vue/no-duplicate-attributes': [
      'error',
      { allowCoexistClass: true, allowCoexistStyle: true },
    ],
  },
  overrides: [
    {
      files: [
        '**/__tests__/*.{j,t}s?(x)',
        '**/tests/unit/**/*.spec.{j,t}s?(x)',
      ],
      env: { jest: true },
    },
  ],
};
