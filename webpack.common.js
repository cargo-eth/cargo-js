module.exports = {
  entry: './src/main.ts',
  output: {
    filename: 'main.js',
    path: `${__dirname}/dist`,
    umdNamedDefine: true,
    library: 'Cargo',
    libraryExport: 'default',
    libraryTarget: 'umd',
  },

  resolve: {
    // Add '.ts' and '.tsx' as resolvable extensions.
    extensions: ['.ts', '.tsx', '.js', '.json'],
  },

  module: {
    rules: [
      // All files with a '.ts' or '.tsx' extension will be handled by 'awesome-typescript-loader'.
      { test: /\.tsx?$/, loader: 'awesome-typescript-loader' },

      // All output '.js' files will have any sourcemaps re-processed by 'source-map-loader'.
      { enforce: 'pre', test: /\.js$/, loader: 'source-map-loader' },
    ],
  },
};
