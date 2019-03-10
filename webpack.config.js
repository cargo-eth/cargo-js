const { CheckerPlugin } = require('awesome-typescript-loader');

module.exports = {
  entry: './src/main.ts',
  output: {
    filename: 'bundle.js',
    path: `${__dirname}/dist`,
    umdNamedDefine: true,
    library: 'cargo',
    libraryExport: 'default',
    libraryTarget: 'umd',
  },

  // Enable sourcemaps for debugging webpack's output.
  devtool: 'source-map',

  resolve: {
    // Add '.ts' and '.tsx' as resolvable extensions.
    extensions: ['.ts', '.tsx', '.js', '.json'],
  },

  watch: true,

  mode: 'development',

  plugins: [new CheckerPlugin()],

  module: {
    rules: [
      // All files with a '.ts' or '.tsx' extension will be handled by 'awesome-typescript-loader'.
      { test: /\.tsx?$/, loader: 'awesome-typescript-loader' },

      // All output '.js' files will have any sourcemaps re-processed by 'source-map-loader'.
      { enforce: 'pre', test: /\.js$/, loader: 'source-map-loader' },
    ],
  },
};
