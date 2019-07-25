module.exports = {
  env: {
    test: {
      plugins: [['@babel/plugin-proposal-class-properties', { loose: true }]],
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        '@babel/preset-typescript',
      ],
    },
  },
};
