const path = require("path");

const WebpackWebExt = require('webpack-webext-plugin');


module.exports = {
    entry: {
        background: "./src/background.js",
        freezeDryThisPage: "./src/freezeDryThisPage.js"
    },
    output: {
        path: path.resolve(__dirname, "addon"),
        filename: "[name].js"
    },
    plugins: [
      new WebpackWebExt({
        runOnce: false,
        argv: ['lint', '-s', 'addon/'],
      }),

      new WebpackWebExt({
        runOnce: true,
        maxRetries: 3,
        argv: ['run', '-s', 'addon/', '--firefox', 'nightly'],
      })
    ]
};
