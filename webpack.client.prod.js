const merge = require('webpack-merge');
const common = require('./webpack.common.js');
const package = require('./package.json');

/**
 * This config is to build the client library that can be used directly in the browser
 * It includes web3
 */
const { externals, ...rest } = common;
module.exports = merge(rest, {
  output: {
    filename: `cargo.${package.version}.js`,
    path: `${__dirname}/dist`,
    umdNamedDefine: true,
    library: 'cargoJs',
    libraryTarget: 'umd',
  },
  mode: 'production',
});
