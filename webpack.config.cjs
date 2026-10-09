/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Custom Webpack configuration for JupyterLab Extension build
 * Explicitly resolves Node.js polyfills (process, path) required by Webpack 5
 * and @jupyterlab/builder's ProvidePlugin across jlpm / yarn / npm environments.
 */

module.exports = {
  resolve: {
    fallback: {
      process: require.resolve('process/browser'),
      path: require.resolve('path-browserify'),
    },
    alias: {
      'process/browser': require.resolve('process/browser'),
      'process/browser.js': require.resolve('process/browser'),
    },
  },
};
