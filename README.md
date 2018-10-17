# FathomFox

A set of tools for developing [Fathom](http://mozilla.github.io/fathom/)
rulesets within Firefox

## Quick Start

Here is an example of how you might use FathomFox to train a Fathom ruleset
that finds the semi-transparent overlays behind in-page pop-ups:

1. Fork, clone, and install the
   [Fathon-Trainees](https://github.com/mozilla/fathom-trainees/) repository as
   per its instructions.
2. Install dependencies and build with `yarn build`, then run `yarn browser` to
   launch Firefox.  `yarn install` (or just `yarn`) will fail with an error
   about an incompatible node version, use `yarn build` to install modules, or
   pass the `--ignore-engines` switch to `yarn install`.
3. Using `about:debugging`, install your fathom-trainess extension by selecting
   its `addon/manifest.json` file.
4. Install [Fathom-Fox](https://addons.mozilla.org/firefox/addon/fathomfox/).
5. Navigate to a web page that has a modal dialog with a background overlay.
6. Using Firefox's developer tools inspector, select the full-page overlay
   element.
7. Switch to the Fathom developer tools tab, enter "overlay" in the label
   field, and click Save Page.
8. After you have labeled several pages like this, drag them from your
   filesystem into an empty Firefox window, being careful not to leave any
   empty tabs.
9. From the main toolbar, select the FathomFox icon, then choose Trainer.
10. Click "Train on the tabs in this window".

## Corpus Collector

First among FathomFox's toolset is a bulk Corpus Collector tool, accessible
from a toolbar button. Enter some URLs, and it "freezes" those pages to your
usual downloads folder, inlining images and CSS into data URLs and getting rid
of JS to keep pages deterministic so they can be used as a training or testing
corpus. (Scripts loading scripts loading other scripts is surprisingly common
in the wild, which often makes pages turn out unpredictably, not to mention
being dependent on the network.) The Corpus Collector is useful for grabbing
hundreds of pages at once, but it doesn't give you the opportunity to stop and
interact with each (though it can scroll to the bottom or wait a predetermined
time before freezing).

## The Developer Tools Panel

Fathom is a supervised-learning system. FathomFox's Developer Tools panel helps
you do the supervision (labeling) of pages that have been bulk-collected. You
can also label pages one at a time, without first saving them locally. This
lets you interact with each page before freezing, ensuring the interesting
elements are showing.

Load a page, right-click the element you want to label, and choose Inspect
Element, which will open Firefox's developer tools. Switch to the Fathom tab,
and enter the label for the inspected element.

You can apply as many labels as you want to various page elements, though there
is a limit of one label per element at the moment. Finally, click Save Page to
pull down a frozen version of the page. That sample is then ready to be used
with the Trainer.

## The Trainer

Also reachable from the toolbar button is the ruleset trainer. Once you have
collected a few dozen sample pages, labeled the interesting elements, and
sketched out a ruleset, this automatically derives coefficients that deliver
the most accuracy. Basically, you open the Trainer and then drag a pile of
samples into the same Firefox window; the Trainer will then try your ruleset
against all those tabs, working through different sets of coefficients until an
optimum is reached.

So that you don't have to fork FathomFox itself, your rulesets go into a second
webextension that you author, the so-called "trainee" extension. An example is
[Fathom Trainees](https://github.com/mozilla/fathom-trainees). See its readme
for more.

For now, the Trainer's transition function is hard-coded to try integral
values, even negative ones. This was chosen to work well with rulesets that
keep their scores within the fuzzy-logic range of (0, 1). This carries the dual
advantages of giving each score an intuitive interpretation as a probability
and making types more composable, since the composition, once we add a future
nth-root step to type finalization, will also be within (0, 1). Adding another
rule to your ruleset will no longer blow through any numeric thresholds you had
programmed in.

## Tips

* Before freezing pages with the Developer Tools panel, use Firefox's
  Responsive Design mode (command-option-M) to set a repeatable 1024x768 window
  size. The Trainer automatically sets this same size during training (by
  default). This will ensure that the proper CSS (which may be driven by media
  queries) will be frozen (and later reloaded) with the page.
* For maximum fidelity, do your corpus capture in a clean copy of Firefox with
  no other add-ons. Some ad blockers will make changes to the DOM, like adding
  style attributes to ad iframes to hide them.

## Thanks

Thanks to Treora for his excellent freeze-dry library!

## Development

1. Install Firefox Nightly or Firefox Developer Edition.
2. Check out the source code.
3. `cd fathom-fox`
4. Install dependencies: `yarn install --ignore-engines` (note `npm` will not
   work as it chooses different dependencies).
5. Bundle up the extension, and launch a new copy of Nightly with it already
   installed: `yarn run build`, then `WEB_EXT_FIREFOX=nightly yarn browser`

## Version History

### 2.2

* Make viewport size customizable during capture.
* Bump freeze delay from 0 to 1. This avoids many dead-object errors during
  capture.

### 2.1

* Add computation of a 95% confidence interval for accuracy, using binomial
  proportion confidence intervals.

### 2.0

* Support customizable viewport sizes in Trainer.
* Stop using `traineeCoeffs` message in favor of `trainee`, which is more
  future-proof. This requires a fathom-trainees fork based on
  d93bc593a08f6503d137df4d35ce2a2bc6b93b6e or later.

### 1.3

* Re-saving frozen pages should now be idempotent most of the time. (glob)
* Solve some causes of Corpus Collector freezing. (glob)
* Add progress reporting during freezing. (glob)
* Use the hostname as a download filename in the absence of a user-provided
  one. (glob)
* Use standard Photon menus for the toolbar button (since the stylesheets have
  now been documented). (glob)

### 1.2.2

* Fix bug where some inspected elements would yield merely "false" in the
  Fathom dev panel.

### 1.2.1

* Fix a packaging problem that was causing the dev panel not to work, due to a
  missing copy of the Simmer library.

### 1.2

* Add a decent UI to the devtools panel. Now you can see what you've labeled!
  (glob)

### 1.1.1

* Fix a bug where the Save button on the devtools panel wouldn't do anything
  unless an element was inspected.

### 1.1

* Add Trainer.
* Switch from npm to yarn.

### 1.0.1

* Fix the "No matching message handler" errors when downloading using the
  Corpus Collector.
* Switch from webpack to rollup.
