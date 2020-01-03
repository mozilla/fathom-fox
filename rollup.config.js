import commonjs from 'rollup-plugin-commonjs';
import resolve from 'rollup-plugin-node-resolve';
import json from 'rollup-plugin-json';
import builtins from 'rollup-plugin-node-builtins';
import globals from 'rollup-plugin-node-globals';
import copy from 'rollup-plugin-copy';
const webpackPostcss = require('./src/rollup-plugin-webpack-postcss/rollup-plugin-webpack-postcss');

/**
 * Return typical rollup settings for a file of a given name.
 */
function mindlesslyFactoredOutSettings(name, globalVarName) {
    return {
        input: 'src/' + name + '.js',
        output: {
            file: 'addon/' + name + '.js',
            format: 'iife',
            name: globalVarName || name  // Convention: name the var the same thing.
        },
        plugins: [
            resolve({preferBuiltins: true}),
            webpackPostcss(),
            commonjs({
                namedExports: {
                    'wu': ['forEach', 'map', 'flatten']
                }
            }),
            json(),
            globals(),
            builtins(),
            copy({
                targets: [
                    { src: 'node_modules/simmerjs/dist/simmer.js', dest: 'addon' },
                ]
            }),
        ],
        watch: {
            chokidar: false
        }
    }
}

export default [
    mindlesslyFactoredOutSettings('contentScript'),
    mindlesslyFactoredOutSettings('evaluate'),
    mindlesslyFactoredOutSettings('rulesets', 'trainees'),
];
