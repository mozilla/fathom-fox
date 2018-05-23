import commonjs from 'rollup-plugin-commonjs';
import resolve from 'rollup-plugin-node-resolve';
import json from 'rollup-plugin-json';


export default [
    {
        input: 'src/contentScript.js',
        output: {
            file: 'addon/contentScript.js',
            format: 'iife',
            name: 'fathomFoxContentScript'
        },
        plugins: [
            resolve(),
            commonjs()
        ]
    },
    {
        input: 'src/train.js',
        output: {
            file: 'addon/train.js',
            format: 'iife',
            name: 'train'
        },
        plugins: [
            resolve(),
            commonjs()
        ]
    },
    {
        input: 'src/test.js',
        output: {
            file: 'addon/test.js',
            format: 'iife',
            name: 'test'
        },
        plugins: [
            resolve(),
            commonjs(),
            json({
                exclude: ['node_modules/**/package.json'],
            })
        ]
    }
];
