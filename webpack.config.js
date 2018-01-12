const path = require("path");

const WebpackWebExt = require('webpack-webext-plugin');


module.exports = {
    entry: {
        background_scripts: "./background_scripts/background.js",
        content_scripts: "./content_scripts/content.js"
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
