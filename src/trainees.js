import {ruleset, rule, dom, type, score, out} from 'fathom-web';
import {ancestors} from 'fathom-web/utilsForFrontend';


/**
 * Rulesets to vectorize or debug
 *
 * More mechanically, a map of names to {coeffs, rulesetMaker, ...} objects.
 * See below for details. The rulesets you specify here show up in the
 * FathomFox UI, from which you can debug a ruleset or turn it into vectors for
 * use with the command-line trainer.
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
    // The ID for this ruleset, which must be the same as the Fathom type you
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

     viewportSize: {width: 1024, height: 768},
     // The content-area size to use while training. Defaults to 1024x768.

     vectorType: 'overlay',
     // The type of node to extract features from when using the Vectorizer

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
                return trapezoid(hDifference + wDifference, 250, 0);  // 250px is getting into "too tall to just be nav or something" territory.
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
                    ret = trapezoid(totalOpacity, .4, .6);
                }
                return ret;
            }

            /**
             * Return whether the fnode's bgcolor is nearly black or white.
             */
            function monochrome(fnode) {
                const rgba = rgbaFromString(getComputedStyle(fnode.element).getPropertyValue('background-color'));
                return trapezoid(1 - saturation(...rgba), .96, 1);
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

            /**
             * Score hidden things real low.
             *
             * For training, this avoids false failures (and thus gives us more
             * accurate accuracy numbers) since some pages have multiple
             * popups, all but one of which are hidden in our captures.
             * However, for actual use, consider dropping this rule, since
             * deleting popups before they pop up may not be a bad thing.
             */
            function visible(fnode) {
                const element = fnode.element;
                for (const ancestor of ancestors(element)) {
                    const style = getComputedStyle(ancestor);
                    if (style.getPropertyValue('visibility') === 'hidden' ||
                        style.getPropertyValue('display') === 'none') {
                        return 0;
                    }
                    // Could add opacity and size checks here, but the
                    // "nearlyOpaque" and "big" rules already deal with opacity
                    // and size. If they don't do their jobs, maybe repeat
                    // their work here (so it gets a different coefficient).
                }
                return 1;
            }

            /* Utility procedures */

            /**
             * Return the extracted [r, g, b, a] values from a string like "rgba(0, 5, 255, 0.8)",
             * and scale them to 0..1. If no alpha is specified, return undefined for it.
             */
            function rgbaFromString(str) {
                const m = str.match(/^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d+(?:\.\d+)?)\s*)?\)$/i);
                if (m) {
                    return [m[1] / 255, m[2] / 255, m[3] / 255, m[4] === undefined ? undefined : parseFloat(m[4])];
                } else {
                    throw new Error("Color " + str + " did not match pattern rgb[a](r, g, b[, a]).");
                }
            }

            /**
             * Scale a number to the range [0, 1].
             *
             * For a rising trapezoid, the result is 0 until the input reaches
             * zeroAt, then increases linearly until oneAt, at which it becomes
             * 1. To make a falling trapezoid, where the result is 1 to the
             * left and 0 to the right, use a zeroAt greater than oneAt.
             */
            function trapezoid(number, zeroAt, oneAt) {
                const isRising = zeroAt < oneAt;
                if (isRising) {
                    if (number <= zeroAt) {
                        return 0;
                    } else if (number >= oneAt) {
                        return 1;
                    }
                } else {
                    if (number >= zeroAt) {
                        return 0;
                    } else if (number <= oneAt) {
                        return 1;
                    }
                }
                const slope = 1 / (oneAt - zeroAt);
                return slope * (number - zeroAt);
            }

            /**
             * Return the saturation 0..1 of a color defined by RGB values 0..1.
             */
            function saturation(r, g, b) {
                const cMax = Math.max(r, g, b);
                const cMin = Math.min(r, g, b);
                const delta = cMax - cMin;
                const lightness = (cMax + cMin) / 2;
                const denom = (1 - (Math.abs(2 * lightness - 1)));
                // Return 0 if it's black (R, G, and B all 0).
                return (denom === 0) ? 0 : delta / denom;
            }

            /* The actual ruleset */

            const rules = ruleset([
                rule(dom('div'), type('overlay')),
                rule(type('overlay'), score(big), {name: 'big'}),
                rule(type('overlay'), score(nearlyOpaque), {name: 'nearlyOpaque'}),
                rule(type('overlay'), score(monochrome), {name: 'monochrome'}),
                rule(type('overlay'), score(suspiciousClassOrId), {name: 'classOrId'}),
                rule(type('overlay'), score(visible), {name: 'visible'}),
                rule(type('overlay').max(), out('overlay'))
            ]);
            return rules;
        }
    }
);

export default trainees;
