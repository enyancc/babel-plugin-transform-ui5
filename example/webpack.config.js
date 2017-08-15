/* eslint-env node  */
var path = require('path');

module.exports = {
  entry: {
    'Component': ['babel-polyfill', path.resolve(__dirname, 'app/Component.mjs')],
    'test/unit/allTests': ['babel-polyfill', path.resolve(__dirname, 'app/test/unit/allTests.mjs')]
  },
  output: {
    path: path.resolve(__dirname, 'app/'),
    filename: '[name].js'
  },
  devtool: 'cheap-module-eval-source-map',
  module: {
    rules: [
      {
        test: /\.m?js$/,
        exclude: /node_modules/,
        loaders: [
          'babel-loader?sourceRoot=./'
        ]
      }
    ]
  }
};
