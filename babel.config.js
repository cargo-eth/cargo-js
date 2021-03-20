module.exports = {
  plugins: [
    ["@babel/plugin-proposal-nullish-coalescing-operator"],
    ["@babel/plugin-proposal-optional-chaining"],
    ["@babel/plugin-transform-runtime",
    {
      "regenerator": true
    }
  ],
    '@babel/plugin-proposal-export-default-from',
    ['@babel/plugin-proposal-class-properties', { loose: true }]

  ],
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    '@babel/preset-typescript',
  ]
};
