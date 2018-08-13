# FathomFox

A set of tools for developing [Fathom](http://mozilla.github.io/fathom/) rulesets within Firefox

## Corpus Collector

First, there is a bulk Corpus Collector tool, accessible from a toolbar button. Enter some URLs, and it "freezes" those pages to your usual downloads folder, inlining images and CSS into data URLs and getting rid of JS to keep pages deterministic so they can be used as a training or testing corpus. (Scripts loading scripts loading other scripts is surprisingly common in the wild, which often makes pages turn out unpredictably, not to mention being dependent on the network.) The Corpus Collector is useful for grabbing hundreds of pages at once, but it doesn't give you the opportunity to stop and interact with each (though it can scroll to the bottom or wait a predetermined time before freezing).

## The Developer Tools Panel

Fathom is a supervised-learning system. FathomFox's Developer Tools panel helps you do the supervision (labeling) of pages that have been bulk-collected. You can also use it as an alternative to bulk collection that lets you interact with each page before freezing. 

Load a page, visit the panel, and apply as many labels as you want to various page elements (a max of one label per element at the moment). When you're done, click Save to pull down a frozen version of the page. That sample is then ready to be used with the Trainer.

## The Trainer

Also reachable from the toolbar button is the ruleset trainer. Once you have collected a few dozen sample pages, labeled the interesting elements, and sketched out a ruleset, this automatically comes up with coefficients that deliver the most accuracy. Basically, you open the trainer and then drag a pile of samples into the same Firefox window; the trainer will then iteratively try your ruleset against all those tabs, working through different sets of coefficients until an optimum is reached.

So that you don't have to fork FathomFox itself, your rulesets go into a second webextension that you author, the so-called "trainee" extension. An example is [Fathom Trainees](https://github.com/mozilla/fathom-trainees). See its readme for more.

For now, the trainer's transition function is hard-coded to try integral values, even negative ones. This was chosen to work well with rulesets that keep their scores within the fuzzy-logic range of (0, 1). This carries the dual advantages of giving each score an intuitive interpretation as a probability and making types more composable, since the composition, once we add a future nth-root final step to type finalization, will also be within (0, 1). Adding another rule to your ruleset will no longer blow through any numeric thresholds you had programmed in.

## Tips

* Before freezing pages with the Developer Tools panel, use Firefox's Responsive Design mode (command-option-M) to set a repeatable window size. Set the same window size during training. This will ensure that the proper CSS (which may be driven by media queries) will be frozen (and later reloaded) with the page.
* For maximum fidelity, do your corpus capture in a clean copy of Firefox with no other add-ons. Some ad blockers will make changes to the DOM, like adding style attributes to ad iframes to hide them.

## Thanks

Thanks to Treora for his excellent freeze-dry library!

## Development

1. Install Firefox Nightly or Firefox Developer Edition.
2. Check out the source code.
3. `cd fathom-fox`
4. Install dependencies: `yarn`. (`npm` seems to choose different dependencies and may not work.)
5. Bundle up the extension, and launch a new copy of Firefox with it already installed: `yarn run build && yarn run browser`

## Version History

### 1.1.1

* Fix a bug where the Save button on the devtools panel wouldn't do anything unless an element was inspected.

### 1.1

* Add Trainer.
* Switch from npm to yarn.

### 1.0.1

* Fix the "No matching message handler" errors when downloading using the Corpus Collector.
* Switch from webpack to rollup.
