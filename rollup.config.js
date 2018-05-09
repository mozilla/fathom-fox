import commonjs from 'rollup-plugin-commonjs';
import resolve from 'rollup-plugin-node-resolve';


export default [
    {
        input: 'src/contentScript.js',
        output: {
            file: 'addon/contentScript.js',
            format: 'cjs'
        },
        plugins: [
            commonjs({
                include: 'node_modules/**'
            }),
            resolve()
        ]
    },
    {
        input: 'src/trainables.js',
        output: {
            file: 'addon/trainables.js',
            format: 'cjs'
        },
        plugins: [
            commonjs({
                include: 'node_modules/**'
            }),
            resolve()
        ]
    }
];
