# Rollup Plugin Webpack PostCSS

An attempt to use webpack within rollup to allow for bundling postcss, since the [dependency cycles in postcss mean rollup can't bundle it](https://github.com/postcss/postcss/issues/1030).

This is a very silly-seeming idea, but it also seems like it might be working?

## Rollup Plugins

- `rollup-plugin-node-resolve`
- **This plugin**
- `rollup-plugin-commonjs`
- `rollup-plugin-node-globals`
- `rollup-plugin-node-builtins`

Other orderings/lists might work, but that's what I'm using atm.

---

⚡💀🔥 **USE AT YOUR OWN RISK** 