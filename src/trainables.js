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
    // instance var.
    function succeeded(doc, [coeffSize]) {
        function heightAndWidth(element) {
            const rect = boundingRect(element);
            const height = rect.bottom - rect.top;
            const width = rect.right - rect.left;
            return [height, width];
        }

        /** Return the number of pixels in an image, as a size metric. */
        function numberOfPixels(element) {
            let [height, width] = heightAndWidth(element);
            return height * width;
        }

        const rules = ruleset(
            // Start with all images:
            rule(dom('img'), type('comic')),
            // Score them by size:
            rule(type('comic'), score(fnode => numberOfPixels(fnode.element) * coeffSize)),
            rule(type('comic').max(), out('comic'))
        );

        const facts = rules.against(doc);
        const found = facts.get('comic');
        if (found.length >= 1) {
            const fnode = found[0];  // arbitrary pick
            if (fnode.element.getAttribute('data-fathom-comic') === "1") {
                return true;
            }
        }
        return false;
    }
);

export default trainables;
