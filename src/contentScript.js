/**
 * This holds references to DOM elements on behalf of our devtools panel which,
 * since it runs in a different process, can't get ahold of them. (You see this
 * in the documented limitations of inspectedWindow.eval(), which can pass only
 * simple JSON objects around.) Essentially, this is the controller, and the
 * dev panel is the view.
 *
 * It also serializes web pages.
 */
import freezeDry from 'freeze-dry';
import {type} from 'fathom-web';


/**
 * Serialize this page and its resources into HTML, and return the HTML.
 */
async function freezeThisPage(options) {
    // Scroll first, then wait. That way, the waiting can also profit
    // dynamically loaded elements toward the bottom of the page.
    if (options.shouldScroll) {
        scrollTo(0, document.body.scrollHeight);
        // TODO: Keep scrolling to the bottom as elements are added that
        // lengthen the page.
    }
    await sleep(options.wait * 1000);
    return freezeDry(window.document, document.URL);
}

/**
 * The default success function for a ruleset: succeed if the found element has
 * a data-fathom attribute equal to the traineeId. We arbitrarily use the first
 * found node if multiple are found.
 *
 * Meanwhile (and optionally), if the wrong element is found, return it in
 * ``moreReturns.badElement`` so the tools can show it to the developer. If
 * there's a finer-grained cost than simply a did-succeed boolean, return it in
 * ``moreReturns.cost``--though beware that this cost should include the
 * success or failure as a high-order component, since the optimizer looks only
 * at cost.
 */
function foundLabelIsTraineeId(facts, traineeId, moreReturns) {
    // TODO: Replace with the guts of successAndScoreGap if it proves good.
    const found = facts.get(traineeId);
    if (found.length) {
        const firstFoundElement = found[0].element;
        if (firstFoundElement.dataset.fathom === traineeId) {
            return true;
        } else {
            moreReturns.badElement = firstFoundElement;
            return false;
        }
    }
}

/**
 * A mindless factoring-out over the rulesetSucceeded and labelBadElement
 * content-script messages
 */
function runTraineeOnThisDocument(traineeId, serializedCoeffs, moreReturns) {
    // Run the trainee ruleset of the given ID with the given coeffs
    // over the document, and report whether it found the right
    // element.
    const trainee = trainees.get(traineeId);
    const facts = trainee.rulesetMaker('dummy').against(window.document);
    facts.setCoeffsAndBiases(serializedCoeffs);
    // successFunction, used only by the Evaluator, has never been documented
    // or used and so can be replaced or removed. It is likely
    // https://github.com/mozilla/fathom- fox/issues/39 will obsolete the
    // entire Evaluator and show confidences on all found elements rather than
    // limiting feedback to a single "bad" element.
    const successFunc = trainee.successFunction || foundLabelIsTraineeId;
    const didSucceed = successFunc(facts, traineeId, moreReturns);
    return {didSucceed, cost: moreReturns.cost || (1 - didSucceed)};
}

/**
 * Run the ruleset on this document, and, if it fails, stick an attr on the
 * element it spuriously found, if any.
 *
 * This seems the least bad way of doing this. Actually constructing a path to
 * the element to pass back to the caller would require attaching simmer.js to
 * the page in the trainee extension and then removing it again, as well as a
 * great deal of messaging. You have to have the devtools panel open to freeze
 * the page, so you'll be staring right at the BAD labels, not adding them
 * undetectably.
 */
function labelBadElement(traineeId, coeffs) {
    const moreReturns = {};
    const results = runTraineeOnThisDocument(traineeId, coeffs, moreReturns);

    // Delete any old labels saying "BAD [this trainee]" that might be lying
    // around so we don't mix the old with the quite-possibly- revised:
    const badLabel = 'BAD ' + traineeId;
    for (const oldBadNode of document.querySelectorAll('[data-fathom="' + badLabel.replace(/"/g, '\\"') + '"]')) {
        delete oldBadNode.dataset.fathom;
    }

    if (!results.didSucceed && moreReturns.badElement) {
        if (!('fathom' in moreReturns.badElement.dataset)) {
            // Don't overwrite any existing human-provided labels, lest we
            // screw up future training runs.
            moreReturns.badElement.dataset.fathom = badLabel;
        }
    }
}

/**
 * Given an element <p id="smoo"><b>foo</b></p>, return the string
 * '<p id="smoo">'.
 *
 * Currently, this will miss weird spellings of closing tags, like </pre  >.
 */
function startTag(element) {
    const startAndEndTags = element.cloneNode(false).outerHTML;  // false means shallow clone
    let ret = '';
    if (startAndEndTags.toUpperCase().endsWith('</' + element.tagName + '>')) {
        // Strip off closing tag:
        ret = startAndEndTags.slice(0, -(element.tagName.length + 3));
    } else {
        ret = startAndEndTags;
    }
    return ret.slice(0, 80);
}

/**
 * Return an array of unweighted scores for each element of a type, plus an
 * indication of whether it is a target element. This is useful to feed to an
 * external ML system. The return value looks like this:
 *
 *    {filename: '3.html',
 *     isTarget: true,
 *     features: [['ruleName1', 4], ['ruleName2', 3]]}
 *
 * We assume, for the moment, that the type of node you're interested in is the
 * same as the trainee ID.
 */
function vectorizeTab(traineeId) {
    const trainee = trainees.get(traineeId);
    const boundRuleset = trainee.rulesetMaker('dummy').against(window.document);
    let time = performance.now()
    const fnodes = boundRuleset.get(type(trainee.vectorType));
    time = performance.now() - time;
    const path = window.location.pathname;
    const isTarget = trainee.isTarget || (fnode => fnode.element.dataset.fathom === traineeId);
    const perNodeStuff = fnodes.map(function featureVectorForFnode(fnode) {
        const scoreMap = fnode.scoresSoFarFor(trainee.vectorType);
        return {
            isTarget: isTarget(fnode),
            // Loop over ruleset.coeffs in order, and spit out each score:
            features: Array.from(trainee.coeffs.keys()).map(ruleName => scoreMap.get(ruleName)),
            markup: startTag(fnode.element)
        };
    });
    return {filename: path.substr(path.lastIndexOf('/') + 1),
            nodes: perNodeStuff,
            time};
}

/**
 * Top-level dispatcher for commands sent from the devpanel or corpus collector
 * to this content script
 */
function dispatch(request) {
    switch (request.type) {
        case 'init':
            injectSimmer();
            break;

        case 'label':
            setLabel(request);
            break;

        case 'freeze':
            return freezePage(request);

        case 'showHighlight':
            showHighlight(request.selector);
            break;

        case 'hideHighlight':
            hideHighlight();
            break;

        case 'rulesetSucceeded':
            try {
                const ret = runTraineeOnThisDocument(request.traineeId, request.coeffs, {});
                return Promise.resolve(ret);
            } catch(exc) {
                throw new Error('Error on ' + window.location + ': ' + exc);
            }

        case 'labelBadElement':
            labelBadElement(request.traineeId, request.coeffs);
            break;

        case 'vectorizeTab':
            return Promise.resolve(vectorizeTab(request.traineeId));

        default:
            return Promise.resolve({});
    }
}
browser.runtime.onMessage.addListener(dispatch);

// Inject the Simmer library into the current page, so we can use it to
// build the CSS path to elements.  This injection only happens when the
// dev panel is first opened.
function injectSimmer() {
    if (document.getElementById('fathom-simmer')) {
        return;
    }
    const script = document.createElement('script');
    script.setAttribute('id', 'fathom-simmer');
    script.setAttribute('src', browser.extension.getURL('simmer.js'));
    document.head.appendChild(script);
}

function removeSimmer() {
    const simmerElement = document.getElementById('fathom-simmer');
    if (simmerElement) {
        simmerElement.parentNode.removeChild(simmerElement);
    }
}

// Set or clear the label on the element specifed by request.selector.
function setLabel(request) {
    if (!request.selector) {
        return;
    }

    // Find target element.
    const inspectedElement = document.querySelector(request.selector);
    if (!inspectedElement) {
        console.error('failed to find element', request.selector);
        return;
    }

    // Update or delete data-fathom attribute.
    if (request.label !== undefined && request.label !== '') {
        inspectedElement.dataset.fathom = request.label;
    } else {
        delete inspectedElement.dataset.fathom;
    }

    // Refresh the devtools panel UI.
    browser.runtime.sendMessage({type: 'refresh'});
}

// Freeze a page at the bidding of the corpus collector or devtools
// save button. Devtools panel calls this indirectly, by way of the
// background script, so it can download the result when done.
// Corpus collector calls directly.
function freezePage(request) {
    // Remove the simmer <script> element.  This doesn't need to be put back
    // as the `Simmer` object will exist and won't need to be recreated.
    removeSimmer();

    // Remove the highlight/overlay.  This will need to be restored.
    hideHighlight();

    return freezeThisPage(request.options)
        .then((html) => {
            if (request.selector) {
                showHighlight(request.selector);
            }
            return html;
        });
}

/**
 * Add a highlighter div over the given element.
 *
 * Firefox otherwise does nothing to make clear that the inspector's selection
 * is even preserved when a different devpanel is forward.
 */
function showHighlight(selector) {
    hideHighlight();

    if (!selector) {
        return;
    }

    const element = document.querySelector(selector);
    if (!element) {
        console.error('failed to find element for', selector);
        return;
    }

    const highlighter = document.createElement('div');
    highlighter.id = 'fathomHighlighter';
    highlighter.style.backgroundColor = '#92DDF4';
    highlighter.style.opacity = '.70';
    highlighter.style.position = 'absolute';
    highlighter.style.zIndex = '99999';
    const rect = element.getBoundingClientRect();
    highlighter.style.width = rect.width + 'px';
    highlighter.style.height = rect.height + 'px';
    highlighter.style.top = rect.top + document.defaultView.pageYOffset + 'px';
    highlighter.style.left = rect.left + document.defaultView.pageXOffset + 'px';
    highlighter.style.padding = '0';
    highlighter.style.margin = '0';
    highlighter.style['border-radius'] = '0';
    document.documentElement.appendChild(highlighter);
}

/**
 * Remove the highlighter div from the page.
 */
function hideHighlight() {
    const highlighter = document.getElementById('fathomHighlighter');
    if (highlighter !== null) {
        highlighter.parentNode.removeChild(highlighter);
    }
}
