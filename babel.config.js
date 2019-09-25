module.exports = {
  plugins: [
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
