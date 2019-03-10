// @flow
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import babel from 'rollup-plugin-babel';
import replace from 'rollup-plugin-replace';
import flow from 'rollup-plugin-flow';

import pkg from './package.json';

export default [
  // browser-friendly UMD build
  {
    input: 'src/main.js',
    output: {
      name: 'cargo',
      file: pkg.browser,
      format: 'umd',
    },
    plugins: [
      // flow(),
      // resolve(), // so Rollup can find `ms`
      // commonjs(), // so Rollup can convert `ms` to an ES module
      replace({
        'process.env.REQUEST_URL': JSON.stringify(
          process.env.REQUEST_URL || `https://www.cargo.com`,
        ),
      }),
      babel({
        babelrc: true,
        exclude: ['node_modules/**'],
        runtimeHelpers: true,
      }),
    ],
  },

  // CommonJS (for Node) and ES module (for bundlers) build.
  // (We could have three entries in the configuration array
  // instead of two, but it's quicker to generate multiple
  // builds from a single configuration where possible, using
  // an array for the `output` option, where we can specify
  // `file` and `format` for each target)
  {
    input: 'src/main.js',
    external: ['ms'],
    output: [
      { file: pkg.main, format: 'cjs' },
      { file: pkg.module, format: 'es' },
    ],
    plugins: [
      babel({
        exclude: ['node_modules/**'],
      }),
    ],
  },
];
