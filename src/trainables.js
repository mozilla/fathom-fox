import {ruleset, rule, dom, type, score, out} from 'fathom-web';


/**
 * A map of names to callables that return whether a hard-coded ruleset query
 * succeeded. All of these become available to train via the UI.
 */
const trainables = new Map();

trainables.set(
    'overlay',
    // I don't think V8 is smart enough to compile this once and then sub in
    // new coeff values. I'm not sure about Spidermonkey. We may want to
    // optimize by rolling it into a class and storing coeffs explicitly in an
    // instance var. [Nope, Spidermonkey does it as efficiently as one could
    // hope, with just a {code, pointer to closure scope} pair.]
    function succeeded(doc, [coeffBig, coeffNearlyOpaque, coeffMonochrome]) {
        /**
         * We avoid returning full 0 from any rule, because that wipes out the tuner's
         * ability to adjust its impact by raising it to a power. .08 is big enough
         * that raising it to an annealer-accessible 1/6 power gets it up to a
         * respectable .65.
         */
        const ZEROISH = .08;
        /**
         * Likewise, .9 is low enough that raising it to 5 gets us down to .53. This is
         * a pretty arbitrary selection. I feel like ZEROISH and ONEISH should be
         * symmetric in some way, but it's not obvious to me how. If they're equal
         * distances from the extremes at ^(1/4) and ^4, for example, they won't be at
         * ^(1/5) and ^5. So I expect we'll revisit this.
         */
        const ONEISH = .9;

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
            return trapezoid(hDifference + wDifference, 250, 0) ** coeffBig;  // 250px is getting into "too tall to just be nav or something" territory.
        }

        /**
         * Return whether the fnode is almost but not entirely opaque.
         */
        function nearlyOpaque(fnode) {
            // TODO: Also draw opacities from the 4th element of rgba(r, g, b, o) colors.
            const opacityStr = getComputedStyle(fnode.element).getPropertyValue('opacity');
            let ret;
            if (opacityStr == '1') {
                ret = ZEROISH;
            } else {
                const opacity = parseInt(opacityStr);
                ret = trapezoid(opacity, .4, .6);
            }
            //console.log("nearly opaque", ret ** coeffNearlyOpaque);
            return ret ** coeffNearlyOpaque;
        }

        /**
         * Return whether the fnode's bgcolor is nearly black or white.
         */
        function monochrome(fnode) {
            const rgb = 
        rgbFromString(getComputedStyle(fnode.element).getPropertyValue('background-color'));
            return trapezoid(1 - saturation(...rgb), .96, 1) ** coeffMonochrome;
        }

        /* Utility procedures */

        /**
         * Return the extracted [r, g, b] values from a string like "rgb(0, 5, 255)",
         * and scale them to 0..1.
         */
        function rgbFromString(str) {
            const m = str.match(/^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d+(?:\.\d+)?)\s*)?\)$/i);
            if (m) {
                return [m[1] / 255, m[2] / 255, m[3] / 255];
            } else {
                throw new Error("Color " + str + " did not match patterns rgb(r, g, b) or rgba(r, g, b, a).");
            }
        }

        /**
         * Scale a number to the range [ZEROISH, ONEISH].
         *
         * For a rising trapezoid, the result is zero until the input reaches zeroAt,
         * then increases linearly until oneAt, at which it becomes one. To make a
         * falling trapezoid, where the result is one to the left and zero to the
         * right, use a zeroAt greater than oneAt.
         */
        function trapezoid(number, zeroAt, oneAt) {
            const isRising = zeroAt < oneAt;
            if (isRising) {
                if (number <= zeroAt) {
                    return ZEROISH;
                } else if (number >= oneAt) {
                    return ONEISH;
                }
            } else {
                if (number >= zeroAt) {
                    return ZEROISH;
                } else if (number <= oneAt) {
                    return ONEISH;
                }
            }
            const slope = (ONEISH - ZEROISH) / (oneAt - zeroAt);
            return slope * (number - zeroAt) + ZEROISH;
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

        const rules = ruleset(
            rule(dom('div'), type('overlay')),
            // Fuzzy AND is multiplication (at least that's the definition we use,
            // since Fathom already implements it and it allows participation of
            // all anded rules.

            // I'm thinking each rule returns a confidence, 0..1, reined in by a sigmoid or trapezoid. That seems to fit the features I've collected well. I can probably make up most of those coefficients. Then we multiply the final results by a coeff each, for weighting. That will cap our total to the sum of the weights. We can then scale that sum down to 0..1 if we want, to build upon, by dividing by the product of the weights. [Actually, that weighting approach doesn't work, since the weights just get counteracted at the end. What we would need is a geometric mean-like approach, where individual rules' output is raised to a power to express its weight. Will Fathom's plain linear stuff suffice for now? If we want to keep an intuitive confidence-like meaning for each rule, we could have the coeffs be the powers each is raised to. I don't see the necessity of taking the root at the end (unless the score is being used as input to some intuitively meaningful threshold later), though we can outside the ruleset if we want. Going with a 0..1 confidence-based range means a rule can never boost a score--only add doubt--but I'm not sure that's a problem. If a rule wants to say "IHNI", it can also return 1 and thus not change the product. (Though they'll add 1 to n in the nth-root. Is that a problem?)] The optimizer will have to consider fractional coeffs so we can lighten up unduly certain rules.
            rule(type('overlay'), score(big)),
            rule(type('overlay'), score(nearlyOpaque)),
            rule(type('overlay'), score(monochrome)),
            rule(type('overlay').max(), out('overlay'))
        );

        const facts = rules.against(doc);
        const found = facts.get('overlay');
        if (found.length >= 1) {
            const fnode = found[0];  // arbitrary pick
            if (fnode.element.getAttribute('data-fathom') === 'overlay') {
                return true;
            }
        }
        return false;
    }
);

export default trainables;
