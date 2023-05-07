module.exports = {
  plugins: ['stylelint-scss'],
  extends: [
    'stylelint-config-standard',
    'stylelint-config-recommended-scss',
    'stylelint-config-recommended-vue',
    'stylelint-rscss/config'
  ],

  rules: {
    'length-zero-no-unit': null,
    'at-rule-empty-line-before': ['always', {
      ignore: ['after-comment'],
      except: [
        'inside-block',
        'after-same-name'
      ]
    }],
    "color-hex-case": null,
    "no-empty-source": null,
    "block-closing-brace-newline-after": null,
    "no-descending-specificity": null,
    "color-function-notation": null,
    "rscss/class-format": null,
    "selector-class-pattern": null,
    "alpha-value-notation": "number",
    "media-feature-name-no-unknown": [
      true,
      {
        "ignoreMediaFeatureNames": [
          "/^prefers-/"
        ]
      }
    ],
    "at-rule-no-unknown": [
      true,
      {
        "ignoreAtRules": [
          "include",
          "function",
          "return",
          "mixin",
          "if",
          "else",
          "for",
          "extend",
          "each",
          "content"
        ]
      }
    ],

    /**
     * DESC:
     * rscss custom rules
     */
    'rscss/no-descendant-combinator': false
  }
}
