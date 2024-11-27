module.exports = {
  plugins: ['stylelint-scss'],
  extends: ['stylelint-config-standard', 'stylelint-config-recommended-scss', 'stylelint-config-recommended-vue'],
  ignoreFiles: ['/app/assets/**/*.css'],

  rules: {
    'length-zero-no-unit': null,
    'at-rule-empty-line-before': [
      'always',
      {
        ignore: ['after-comment'],
        except: ['inside-block', 'after-same-name'],
      },
    ],
    'no-empty-source': null,
    'no-descending-specificity': null,
    'color-function-notation': null,
    'selector-class-pattern': null,
    'alpha-value-notation': 'number',
    'import-notation': 'string',
    'media-feature-name-no-unknown': [
      true,
      {
        ignoreMediaFeatureNames: ['/^prefers-/'],
      },
    ],
    'at-rule-no-unknown': [
      true,
      {
        ignoreAtRules: ['include', 'function', 'return', 'mixin', 'if', 'else', 'for', 'extend', 'each', 'content'],
      },
    ],
  },
};
