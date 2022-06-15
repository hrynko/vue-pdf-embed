const { merge } = require('webpack-merge')
const CopyPlugin = require('copy-webpack-plugin')
const TerserPlugin = require('terser-webpack-plugin')
const { VueLoaderPlugin: Vue2LoaderPlugin } = require('vue-loader')
const { VueLoaderPlugin: Vue3LoaderPlugin } = require('vue-loader-next')

const commonConfig = {
  mode: 'production',
  entry: './src/index.js',
  output: {
    library: {
      name: 'vue-pdf-embed',
      type: 'umd',
    },
  },
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
        test: /\.s?css$/,
        use: ['vue-style-loader', 'css-loader', 'sass-loader'],
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
      new TerserPlugin({
        extractComments: false,
        terserOptions: {
          format: {
            comments: false,
          },
        },
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
  merge(commonConfig, {
    output: {
      clean: true,
      filename: 'vue2-pdf-embed.js',
    },
    plugins: [new Vue2LoaderPlugin()],
  }),
  merge(commonConfig, {
    output: {
      filename: 'vue3-pdf-embed.js',
    },
    plugins: [
      new Vue3LoaderPlugin(),
      new CopyPlugin({ patterns: [{ from: 'types' }] }),
    ],
  }),
]
