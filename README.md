# FathomFox

A set of tools for developing [Fathom](http://mozilla.github.io/fathom/) rulesets within Firefox

## Corpus Collector

First, there is a bulk Corpus Collector tool, accessible from a toolbar button. Enter some URLs, and it "freezes" those pages to your usual downloads folder, inlining images and CSS into data URLs and getting rid of JS to keep pages deterministic so they can be used as a training or testing corpus. (Scripts loading scripts loading other scripts is surprisingly common nowadays, which often makes pages turn out unpredictably, not to mention being dependent on the network.) The Corpus Collector is useful for grabbing hundreds of pages at once, but it doesn't give you the opportunity to stop and interact with each page (though it can scroll to the bottom of each page or wait a predetermined time before freezing).

## The Developer Tools Panel

For slower-paced corpus collection that gives you the chance to interact with each page and to label elements for later training, there's a developer-tools panel. Load a page, visit the panel, and apply as many labels as you want to various page elements (a max of one label per element at the moment). When you're done, click Save to pull down a frozen version of the page.

## Tips

* Before freezing pages with the Developer Tools panel, use Firefox's Responsive Design mode (command-option-M) to set a repeatable window size. Set the same window size during training. This will ensure that the proper CSS (which may be driven by media queries) will be frozen (and later reloaded) with the page.
* For maximum fidelity, do your corpus capture in a clean copy of Firefox with no other add-ons. Some ad blockers will make changes to the DOM, like adding style attributes to ad iframes to hide them.

## Thanks

Thanks to Treora for his excellent freeze-dry library!

## Development

1. Install Firefox Nightly.
2. Check out the source code.
3. `cd fathom-fox`
4. Install dependencies: `npm install`
5. Bundle up the extension, and launch a new copy of Nightly with it already installed: `npm run build`

## Version History

### 1.0.1

* Fix the "No matching message handler" errors when downloading using the Corpus Collector.
* Switch from webpack to rollup.
