const { merge } = require('webpack-merge');
const common = require('./webpack.common');

module.exports = merge(common, {
  mode: 'production',
  devtool: 'source-map',
  performance: { hints: 'warning', maxAssetSize: 3000000, maxEntrypointSize: 3000000 },
});
