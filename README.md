# Fathom WebExtension
This is home to various tools for developing Fathom rulesets, especially ones which benefit from having a GUI.

## Status
For the moment, this provides a "corpus download" tool, accessible from a toolbar button. Enter some URLs, and it downloads those pages, inlining images and CSS into data URLs and getting rid of JS to keep pages deterministic so they can be used as a training or testing corpus. (Scripts loading scripts loading other scripts is surprisingly common nowadays, which often makes pages turn out unpredictably, not to mention being dependent on the network.) Someday it will also do other things to aid the development of Fathom rulesets, but, in the meantime, feel free to enjoy what we have!

## To Run
1. Install Firefox Nightly.
2. `cd fathom-webextension`
3. Install dependencies: `npm install`
4. Bundle up the extension, and launch a new copy of Nightly with it already installed: `npm run build`
5. Smack the new toolbar button.
6. Find the resulting serialized pages wherever you have Firefox configured to download things.
