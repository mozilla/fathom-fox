const path = require("path");

const WebpackWebExt = require('webpack-webext-plugin');


module.exports = {
    entry: {
        backgroundScripts: "./backgroundScripts/background.js",
        contentScripts: "./contentScripts/content.js"
    },
    output: {
        path: path.resolve(__dirname, "addon"),
        filename: "[name]/index.js"
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
