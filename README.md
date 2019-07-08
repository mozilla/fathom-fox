# FathomFox

A set of tools for developing [Fathom](http://mozilla.github.io/fathom/) rulesets within Firefox

## Quick Start

Here is an example of how you might use FathomFox to develop a Fathom ruleset that finds the semi-transparent overlays behind in-page pop-ups:

1. Fork, clone, and install the [Fathon-Trainees](https://github.com/mozilla/fathom-trainees/) repository as per its instructions.
2. Install dependencies and build with `yarn build`, then run `yarn browser` to launch Firefox. (`yarn install` (or just `yarn`) will fail with an error about an incompatible node version, so be sure to use `yarn build` to install modules, or pass the `--ignore-engines` switch to `yarn install`.)
3. Using `about:debugging`, install your fathom-trainees extension by selecting its `addon/manifest.json` file.
4. Install [Fathom-Fox](https://addons.mozilla.org/firefox/addon/fathomfox/).
5. Navigate to a web page that has what you're trying to recognize: a background overlay behind a modal dialog.
6. Using Firefox's developer tools inspector, select the overlay element.
7. Switch to the Fathom developer tools tab, enter "overlay" in the label field, and click Save Page.
8. After you have labeled about 20 pages like this, click the FathomFox icon in the main toolbar, and choose Vectorizer.
9. Use the Vectorizer to mash down your labeled pages into vectors of floats and save them as a JSON file.
10. [Use the commandline trainer](https://mozilla.github.io/fathom/training.html#running-the-trainer) to imbibe the vectors and come up with an optimal set of coefficients.

## Where Your Ruleset Goes

So that you don't have to fork FathomFox itself, the ruleset you're developing goes into a second web extension that you author, the so-called "trainee" extension. An example is [Fathom Trainees](https://github.com/mozilla/fathom-trainees), which you can fork. See its readme for more.

## Corpus Collector

First among FathomFox's toolset is a bulk Corpus Collector tool, accessible from a toolbar button. Enter some URLs, and it "freezes" those pages to your usual downloads folder, inlining images and CSS into data URLs and getting rid of JS to keep pages deterministic so they can be used as a training or testing corpus. (Scripts loading scripts loading other scripts is surprisingly common in the wild, which often makes pages turn out unpredictably, not to mention being dependent on the network.) The Corpus Collector is useful for grabbing hundreds of pages at once, but it doesn't give you the opportunity to stop and interact with each (though it can scroll to the bottom or wait a predetermined time before freezing).

## Developer Tools Panel

Fathom is a supervised-learning system. FathomFox's Developer Tools panel helps you do the supervision (labeling) of pages that have been bulk-collected. You can also label pages one at a time, without first saving them locally. This lets you interact with each page before freezing, ensuring the interesting elements are showing.

Load a page, right-click the element you want to label, and choose Inspect Element, which will open Firefox's developer tools. Switch to the Fathom tab, and enter the label for the inspected element.

You can apply as many labels as you want to various page elements, though there is a limit of one label per element at the moment. Finally, click Save Page to pull down a frozen version of the page. That sample is then ready to be used with the Trainer.

## Vectorizer

Once you've labeled your corpus, you'll need a file of feature vectors you can feed to the trainer.

1. Open the Vectorizer from FathomFox's toolbar button. 
2. Give the Vectorizer a list of your labeled pages' filenames.
3. Change the Base URL to the address from which you're serving the pages.
4. Click Vectorize, the pages will flash by, and the vectors will appear in your Downloads folder.

The Retry on Error checkbox should generally stay on, to work around apparently unavoidable spurious errors in the web extension communication APIs. However, turn it off during ruleset debugging; that way, you can see your actual mistakes more promptly.

## Trainer

The actual training functionality of the FathomFox Trainer is deprecated in favor of the much more efficient [commandline tool](https://mozilla.github.io/fathom/training.html#running-the-trainer), but its Evaluate function is still useful for debugging.

Once you have a decent set of coefficients and biases computed, sub them into your ruleset, open some troublesome pages in a Firefox window, and invoke the FathomFox Trainer. From there, click Evaluate to run the ruleset over the loaded tabs. Any pages with misrecognized nodes will show up in red; click those to see which element was wrongly selected. Unfortunately, you need to manually show the dev tools and switch to the Fathom panel once you get to the page in question; there aren't yet web extension APIs to do it automatically. Once you do, you'll see a quick and dirty representation of the "bad" element: a new label called "BAD [the trainee ID]". Be sure to delete this if you choose to re-save the page for some reason. Also note that the BAD label is created only when the bad cell is clicked, for speed; if you navigate to the bad page manually, the label won't be there, or there might be an old label from a previous iteration.

## Tips

* Before freezing pages with the Developer Tools panel, use Firefox's Responsive Design mode (command-option-M) to set a repeatable 1024x768 window size. The Vectorizer automatically sets this same size by default. This will ensure that the proper CSS (which may be driven by media queries) will be frozen (and later reloaded) with the page.
* For maximum fidelity, do your corpus capture in a clean copy of Firefox with no other add-ons. Some ad blockers will make changes to the DOM, like adding style attributes to ad iframes to hide them.

## Thanks

Thanks to Treora for his excellent freeze-dry library!

## Development

1. Install Firefox Nightly or Firefox Developer Edition.
2. Check out the source code.
3. `cd fathom-fox`
4. Install dependencies: `yarn install --ignore-engines`. (Note that `npm` will not work, as it chooses different dependencies.)
5. Bundle up the extension, and launch a new copy of Nightly with it already installed: `yarn run build`, then `WEB_EXT_FIREFOX=nightly yarn browser`

## Version History

### 3.1

* Add an Evaluate button to the Trainer, useful for ruleset debugging.
* Add a Base URL field to the Vectorizer, which saves a lot of find-and-replacing on page filenames.
* Add a Retry On Error checkbox to the Vectorizer so retrying can be disabled during ruleset debugging.
* Document Vectorizer.

### 3.0

* Switch to Fathom 3. This requires a fathom-trainees fork based on tag 3.0 or later. Equivalently, you can make these changes:
  * Switch to specifying coefficients as a Map instead of an Array. If you don't want to name your rules, Fathom will auto-name them `_0`, `_1`, etc., in order of appearance in the ruleset.
  * The `rulesetMaker` function no longer takes any params. In Fathom 3, all weighting is done internal to the framework.
  * All rules should return a value between 0 and 1, representing a confidence.
* Add the Vectorizer tool, which exports feature vectors for optimization with Fathom 3's commandline tool.
* Fix additional causes of duplicate downloads when using the Corpus Collector on recent versions of Firefox. I think they're really all gone now.

### 2.3.1

* Fix Corpus Collector spewing extra bullet points, closing the wrong tabs, downloading duplicates, and generally misbehaving in recent Firefox versions (e.g. 65).

### 2.3

* Clicking a good/bad cell now takes you to that sample's tab and, in the case of a bad cell, indicates which element was wrongly selected, which is invaluable for debugging. Identifying the element requires a fathom-trainees fork that pulls in Fathom 2.8. If you have a custom success function, you must also add a third param to it and scribble a ``badElement`` property on the received object.
* Add a Pause button to the Trainer. This is useful while on battery power or to take the load off Firefox's JS thread so the dev tools can run quickly.

### 2.2

* Make viewport size customizable during capture.
* Bump default freeze delay from 0 to 1. This avoids many dead-object errors during bulk capture.
* Limit length of tags in devtools panel so they don't make it unusably wide.
* Focus the new label field after inspecting an element and switching to the Fathom devtools panel. This makes for faster entry.

### 2.1

* Add computation of a 95% confidence interval for accuracy, using binomial proportion confidence intervals.

### 2.0

* Support customizable viewport sizes in Trainer.
* Stop using `traineeCoeffs` message in favor of `trainee`, which is more future-proof. This requires a fathom-trainees fork based on d93bc593a08f6503d137df4d35ce2a2bc6b93b6e or later.

### 1.3

* Re-saving frozen pages should now be idempotent most of the time. (glob)
* Solve some causes of Corpus Collector freezing. (glob)
* Add progress reporting during freezing. (glob)
* Use the hostname as a download filename in the absence of a user-provided one. (glob)
* Use standard Photon menus for the toolbar button (since the stylesheets have now been documented). (glob)

### 1.2.2

* Fix bug where some inspected elements would yield merely "false" in the Fathom dev panel.

### 1.2.1

* Fix a packaging problem that was causing the dev panel not to work, due to a missing copy of the Simmer library.

### 1.2

* Add a decent UI to the devtools panel. Now you can see what you've labeled! (glob)

### 1.1.1

* Fix a bug where the Save button on the devtools panel wouldn't do anything unless an element was inspected.

### 1.1

* Add Trainer.
* Switch from npm to yarn.

### 1.0.1

* Fix the "No matching message handler" errors when downloading using the Corpus Collector.
* Switch from webpack to rollup.
