# FathomFox
A set of tools for developing [Fathom](http://mozilla.github.io/fathom/) rulesets within Firefox

## Status
So far, there are two tools.

First, there is a bulk Corpus Collector tool, accessible from a toolbar button. Enter some URLs, and it downloads those pages to your usual downloads folder, inlining images and CSS into data URLs and getting rid of JS to keep pages deterministic so they can be used as a training or testing corpus. (Scripts loading scripts loading other scripts is surprisingly common nowadays, which often makes pages turn out unpredictably, not to mention being dependent on the network.) The Corpus Collector is useful for grabbing hundreds of pages at once, but it doesn't give you the opportunity to stop for each one and label DOM elements.

For slower-paced corpus collection that gives you the chance to label elements for later training, there's a developer-tools panel. Load a page, visit the panel, and apply as many labels as you want to various page elements (a max of one label per element at the moment). When you're done, click Save to pull down a frozen version of the page.

Lots more to come!

## To Run From A Source Checkout
1. Install Firefox Nightly.
2. `cd fathom-fox`
3. Install dependencies: `npm install`
4. Bundle up the extension, and launch a new copy of Nightly with it already installed: `npm run build`
5. Smack the new toolbar button.
