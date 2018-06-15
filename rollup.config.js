import commonjs from 'rollup-plugin-commonjs';
import resolve from 'rollup-plugin-node-resolve';
import json from 'rollup-plugin-json';


/**
 * Return typical rollup settings for a file of a given name.
 */
function mindlesslyFactoredOutSettings(name) {
    return {
        input: 'src/' + name + '.js',
        output: {
            file: 'addon/' + name + '.js',
            format: 'iife',
            name  // Convention: name the var the same thing.
        },
        plugins: [
            resolve(),
            commonjs({
                namedExports: {
                    'wu': ['forEach', 'map', 'flatten']
                }
            }),
            json()
        ]
    }
}

export default [
    mindlesslyFactoredOutSettings('contentScript'),
    mindlesslyFactoredOutSettings('train'),
    mindlesslyFactoredOutSettings('trainables')
];
