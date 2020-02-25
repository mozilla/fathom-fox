# FathomFox

A set of tools for developing [Fathom](http://mozilla.github.io/fathom/) rulesets within Firefox

## Quick Start

Here is an example of how you might use FathomFox to develop a Fathom ruleset that finds the semi-transparent overlays behind in-page pop-ups:

### Get FathomFox Running

1. Clone the [FathomFox repository](https://github.com/mozilla/fathom-fox/). (This is needed to author rulesets. If you wish merely to collect a corpus, you may install FathomFox from [addons.mozilla.org](https://addons.mozilla.org/en-US/firefox/addon/fathomfox/).)
2. From within the checkout, install dependencies: `yarn run build`.
3. Run a clean copy of Firefox with FathomFox installed: `yarn run browser`.
4. Run `yarn run watch` in a separate terminal. This will keep your running copy of FathomFox up to date as you edit your ruleset.

### Collect a Corpus

1. Navigate to a web page that has what you're trying to recognize: a background overlay behind a modal dialog.
2. Using Firefox's developer tools inspector, select the overlay element.
3. Switch to the Fathom developer tools tab, enter "overlay" in the label field, and click Save Page.
4. Label about 20 additional pages like this.

### Write and Train a Ruleset

1. Take a first pass at [writing a ruleset](https://mozilla.github.io/fathom/using.html) to recognize the overlays, and put it in `fathom-fox/src/rulesets.js`, replacing the example ruleset. (Ultimately, you should keep `rulesets.js` with your own project and hard-link it into FathomFox.)
2. Click the FathomFox icon in the main toolbar, and choose Vectorizer.
3. Use the Vectorizer to boil down your labeled pages into vectors of floats and save them as a JSON file.
4. [Use the commandline trainer](https://mozilla.github.io/fathom/training.html#running-the-trainer) to imbibe the vectors and come up with an optimal set of coefficients.
5. Use the trained ruleset in your application.

[A more detailed treatment of Fathom authoring workflow](https://mozilla.github.io/fathom/training.html) is in the Fathom manual.

## Corpus Collector

First among FathomFox's toolset is a bulk Corpus Collector tool, accessible from a toolbar button. Enter some URLs, and it "freezes" those pages to your usual downloads folder, inlining images and CSS into data URLs and getting rid of JS to keep pages deterministic so they can be used as a training or testing corpus. (Scripts loading scripts loading other scripts is surprisingly common in the wild, which often makes pages turn out unpredictably, not to mention being dependent on the network.) The Corpus Collector is useful for grabbing hundreds of pages at once, but it doesn't give you the opportunity to stop and interact with each (though it can scroll to the bottom or wait a predetermined time before freezing).

## Developer Tools Panel

Fathom is a supervised-learning system. FathomFox's Developer Tools panel helps you do the supervision (labeling) of pages that have been bulk-collected. You can also label pages one at a time, without first saving them locally. This lets you interact with each page before freezing, ensuring the interesting elements are showing.

Load a page, right-click the element you want to label, and choose Inspect Element, which will open Firefox's developer tools. Switch to the Fathom tab, and enter the label for the inspected element.

You can use as many distinct labels as you want, though there is a limit of one label per element at the moment. Finally, click Save Page to pull down a frozen version of the page. That sample is then ready to be used with the Trainer.

## Vectorizer

Once you've labeled your corpus, you'll need a file of feature vectors you can feed to the [training commandline tool](https://mozilla.github.io/fathom/training.html#running-the-trainer).

1. Open the Vectorizer from FathomFox's toolbar button. 
2. Give the Vectorizer a list of your labeled pages' filenames.
3. Change the Base URL to the address from which you're serving the pages with `fathom-serve`.
4. Click Vectorize, the pages will flash by, and the vectors will appear in your Downloads folder.

The Retry on Error checkbox should generally stay on, to work around apparently unavoidable spurious errors in the web extension communication APIs. However, turn it off during ruleset debugging; that way, you can see your actual mistakes more promptly.

## Evaluator

Once you have a decent set of coefficients and biases computed, paste them into `rulesets.js`, open some troublesome pages in a Firefox window, and invoke the FathomFox Evaluator. From there, click Evaluate to run the ruleset over the loaded tabs. Any pages with misrecognized nodes will show up in red; click those to see which element was wrongly selected. Unfortunately, you need to manually show the dev tools and switch to the Fathom panel once you get to the page in question; there aren't yet web extension APIs to do it automatically. Once you do, you'll see a quick and dirty representation of the "bad" element: a new label called "BAD [the trainee ID]". Be sure to delete this if you choose to re-save the page for some reason. Also note that the BAD label is created only when the bad cell is clicked, for speed; if you navigate to the bad page manually, the label won't be there, or there might be an old label from a previous iteration.

## Tips

* Before freezing pages with the Developer Tools panel, use Firefox's Responsive Design mode (command-option-M) to set a repeatable 1024x768 window size. The Vectorizer automatically sets this same size by default. This will ensure that the proper CSS (which may be driven by media queries) will be frozen (and later reloaded) with the page.
* For maximum fidelity, do your corpus capture in a clean copy of Firefox with no other add-ons. (This will automatically happen if you invoke FathomFox with `yarn run browser`.) Some ad blockers will make changes to the DOM, like adding style attributes to ad iframes to hide them.
* You can press `Ctrl+Shift+O` to save and download a page for pages with hover-to-show elements you want visible upon saving.

## Thanks

Thanks to Treora for his excellent freeze-dry library!

## Development

To work on FathomFox itself, do the steps under [Get FathomFox Running](#get-fathomfox-running) above.

## Version History

### 3.3

* The Vectorizer now operates in parallel, resulting in large speed gains.
* Merge fathom-trainees info FathomFox. This makes fewer repos to clone, fewer addons to install, and fewer build processes to babysit for ruleset authors. It also means a simpler FathomFox with less message passing.
* The Vectorizer now shows an error message when a scoring callback returns undefined. This helps catch certain common mistakes:
  * A name mismatch between the `name` value passed into a rule and the name of the rule in the list of `[ruleName, coefficient]` pairs referenced in the ruleset
  * A scoring callback failing to return a number
  * Corner cases in DOM or CSSOM routines, e.g. `innerText` returning `null` instead of the empty string in Firefox
* Add `isTarget` hook to trainees to customize what the Vectorizer considers a target.
* Automatically add a slash to the end of the Vectorizer base URL if there isn't one.

### 3.2

* Freezing pages now takes only 1/7 as long, thanks to an upgrade to the freeze-dry library.
* There's now a keyboard shortcut for freezing the current page: command-shift-O. This lets you capture hover states.
* The original URL of each frozen page is now preserved in an HTML attribute.
* Rather than always defaulting to 1024x768 for the Viewport Size in the Vectorizer, pull the default from the `viewportSize` of the selected trainee.
* Remove obsolete Trainer, pieces of which now remain solely as an Evaluator, for debugging rulesets.

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
