import {ruleset, rule, dom, type, score, out} from 'fathom-web';
import {ancestors, isVisible, linearScale, rgbaFromString, saturation} from 'fathom-web/utilsForFrontend';


/**
 * Rulesets to vectorize or debug (and metadata about them)
 *
 * More mechanically, a map of names to {coeffs, rulesetMaker, ...} objects,
 * which we call "trainees". The rulesets you specify here show up in the
 * FathomFox UI, from which you can debug a ruleset or turn it into vectors for
 * use with the command-line trainer. Most often, all the entries here point to
 * the same ruleset but have different values of `vectorType` for separately
 * training each type of thing the ruleset recognizes.
 */
const trainees = new Map();

/**
 * An example ruleset. Replace it with your own.
 *
 * This one finds the full-screen, content-blocking overlays that often go
 * behind modal popups. It's not the most well-honed thing, but it's simple and
 * short.
 */
trainees.set(
    // The ID for this trainee, which must be the same as the Fathom type you
    // are evaluating, if you are using the Evaluator:
    'overlay',

    // Here we paste in coefficients from fathom-train. This lets us use the
    // Evaluator to see what Fathom is getting wrong:
    {coeffs: new Map([  // [rule name, coefficient]
        ['big', 50.4946],
        ['nearlyOpaque', 48.6396],
        ['monochrome', 42.8406],
        ['classOrId', 0.5005],
        ['visible', 55.8750]]),
     // Bias is -139.3106 for this example, though that isn't needed until
     // production.

     // The content-area size to use while training. Defaults to 1024x768.
     viewportSize: {width: 1024, height: 768},

     // The type of node to extract features from when using the Vectorizer
     vectorType: 'overlay',

     rulesetMaker:
        function () {
            /**
             * Return whether the passed-in div is the size of the whole viewport/document
             * or nearly so.
             */
            function big(fnode) {
                // Compare the size of the fnode to the size of the viewport. So far, spot-
                // checking shows the overlay is never the size of the whole document, just
                // the viewport.
                const rect = fnode.element.getBoundingClientRect();
                const hDifference = Math.abs(rect.height - window.innerHeight);
                const wDifference = Math.abs(rect.width - window.innerWidth);
                return linearScale(hDifference + wDifference, 250, 0);  // 250px is getting into "too tall to just be nav or something" territory.
            }

            /**
             * Return whether the fnode is almost but not entirely opaque.
             */
            function nearlyOpaque(fnode) {
                const style = getComputedStyle(fnode.element);
                const opacity = parseFloat(style.getPropertyValue('opacity'));
                let bgColorAlpha = rgbaFromString(style.getPropertyValue('background-color'))[3];
                if (bgColorAlpha === undefined) {
                    bgColorAlpha = 1;
                }
                const totalOpacity = opacity * bgColorAlpha;
                let ret;
                if (totalOpacity === 1) {  // seems to work even though a float
                    ret = 0;
                } else {
                    ret = linearScale(totalOpacity, .4, .6);
                }
                return ret;
            }

            /**
             * Return whether the fnode's bgcolor is nearly black or white.
             */
            function monochrome(fnode) {
                const rgba = rgbaFromString(getComputedStyle(fnode.element).getPropertyValue('background-color'));
                return linearScale(1 - saturation(...rgba), .96, 1);
            }

            function suspiciousClassOrId(fnode) {
                const element = fnode.element;
                const attributeNames = ['class', 'id'];
                let numOccurences = 0;
                function numberOfSuspiciousSubstrings(value) {
                    return value.includes('popup') + value.includes('modal') + value.includes('overlay') + value.includes('underlay') + value.includes('backdrop');
                }

                for (const name of attributeNames) {
                    let values = element.getAttribute(name);
                    if (values) {
                        if (!Array.isArray(values)) {
                            values = [values];
                        }
                        for (const value of values) {
                            numOccurences += numberOfSuspiciousSubstrings(value);
                        }
                    }
                }

                // 1 occurrence gets us to about 75% certainty; 2, 92%. It bottoms
                // out at 0 and tops out at 1.
                // TODO: Figure out how to derive the magic number .1685 from
                // 0 and 1.
                return (-(.3 ** (numOccurences + .1685)) + 1);
            }

            /* The actual ruleset */

            const rules = ruleset([
                rule(dom('div'), type('overlay')),
                rule(type('overlay'), score(big), {name: 'big'}),
                rule(type('overlay'), score(nearlyOpaque), {name: 'nearlyOpaque'}),
                rule(type('overlay'), score(monochrome), {name: 'monochrome'}),
                rule(type('overlay'), score(suspiciousClassOrId), {name: 'classOrId'}),
                rule(type('overlay'), score(isVisible), {name: 'visible'}),
                rule(type('overlay').max(), out('overlay'))
            ]);
            return rules;
        }

     // isTarget is an optional function which returns whether the Vectorizer
     // should consider a fnode a target. The default is to consider it a
     // target iff its ``data-fathom`` attribute === the trainee ID.
     //
     // isTarget: fnode => fnode.element.dataset.fathom === 'foo'
    }
);

export default trainees;
