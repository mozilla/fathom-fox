# FathomFox
This is a WebExtension which provides tools within Firefox for developing [Fathom](http://mozilla.github.io/fathom/) rulesets.

## Status
For the moment, there is a Corpus Collector tool, accessible from a toolbar button. Enter some URLs, and it downloads those pages, inlining images and CSS into data URLs and getting rid of JS to keep pages deterministic so they can be used as a training or testing corpus. (Scripts loading scripts loading other scripts is surprisingly common nowadays, which often makes pages turn out unpredictably, not to mention being dependent on the network.) Someday it will also do other things to aid the development of Fathom rulesets, but, in the meantime, feel free to enjoy what we have!

## To Run
1. Install Firefox Nightly.
2. `cd fathom-fox`
3. Install dependencies: `npm install`
4. Bundle up the extension, and launch a new copy of Nightly with it already installed: `npm run build`
5. Smack the new toolbar button.
6. Find the resulting serialized pages wherever you have Firefox configured to download things.
