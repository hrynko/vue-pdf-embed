/* eslint-disable no-undef */

const UglifyJsPlugin = require('uglifyjs-webpack-plugin')
const { VueLoaderPlugin: Vue2LoaderPlugin } = require('vue-loader')
const { VueLoaderPlugin: Vue3LoaderPlugin } = require('vue-loader-next')

const baseConfig = {
  mode: 'production',
  entry: './src/index.js',
  module: {
    rules: [
      {
        test: /\.js$/,
        loader: 'babel-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.vue$/,
        loader: 'vue-loader',
      },
      {
        test: /\.worker\.js$/,
        loader: 'worker-loader',
        options: {
          inline: 'no-fallback',
        },
      },
    ],
  },
  optimization: {
    minimizer: [
      new UglifyJsPlugin({
        parallel: true,
      }),
    ],
  },
  externals: {
    vue: 'vue',
  },
  performance: {
    hints: false,
  },
}

module.exports = [
  {
    ...baseConfig,
    output: {
      filename: 'vue2-pdf-embed.js',
      library: {
        name: 'vue-pdf-embed',
        type: 'umd',
      },
    },
    plugins: [new Vue2LoaderPlugin()],
  },
  {
    ...baseConfig,
    output: {
      filename: 'vue3-pdf-embed.js',
      library: {
        name: 'vue-pdf-embed',
        type: 'umd',
      },
    },
    plugins: [new Vue3LoaderPlugin()],
  },
]
