module.exports = {
  'env': {
    'browser': true,
    'commonjs': true,
    'es2021': true,
  },
  'extends': [
    'google',
    'eslint:recommended'
  ],
  'parserOptions': {
    'ecmaVersion': 'latest',
  },
  'rules': {
    '@typescript-eslint/no-var-requires': 0,
    'quotes': ["error", "double", { "avoidEscape": true }],
    'require-jsdoc': 0,
    'semi': 0,
    'comma-dangle': ["error", "never"],
    'camelcase': 'off',
    'prefer-const': 'off',
    'max-len': ["error", { "code": 120 }]
  },
};
