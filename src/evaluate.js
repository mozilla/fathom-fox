let gCoeffsDiv, gAccuracyDiv, gCiDiv, gCostDiv, gGoodBadDiv = false;

class Evaluator {
    constructor(tabs, traineeId) {
        this.tabs = tabs;
        this.traineeId = traineeId;
    }

    async evaluate() {
        const coeffs = trainees.get(this.traineeId).coeffs;
        const successReport = await this.verboseSuccessReports(coeffs);
        const cost = successReport.reduce((accum, value) => accum + value.cost, 0);
        updateOutputs(coeffs, cost, successReport);
    }

    /**
     * Try the ruleset on each tab, and return a bigger blob of info that
     * allows us to show the user which element it found, for debugging.
     */
    async verboseSuccessReports(coeffs) {
        const results = await this.resultsForPages(coeffs);
        return results.map((result, i) => ({
            didSucceed: result.didSucceed,
            cost: result.cost,
            filename: urlFilename(this.tabs[i].url),
            tabId: this.tabs[i].id}));
    }

    /**
     * Send a message to all the pages in the corpus, telling them "Run ruleset
     * ID X, and tell me how its default query (the one with the same out() key
     * as its ID) did."
     *
     * @return an Array of {didSucceed: bool, cost: number} objects, one per
     *     page
     */
    async resultsForPages(coeffs) {
        return browser.runtime.sendMessage(
            {
                type: 'rulesetSucceededOnTabs',
                tabIds: this.tabs.map(tab => tab.id),
                traineeId: this.traineeId,
                coeffs: Array.from(coeffs.entries())
            }
        );
    }
}

async function evaluateTabs() {
    // Grey out Evaluate button:
    const evaluateButton = document.getElementById('evaluate');
    evaluateButton.disabled = true;

    // Show output.
    document.getElementById('output').classList.remove('hidden');

    try {
        // TODO: Using "active" here rather than a tab ID presents a race condition
        // if you quickly switch away from the tab after clicking the Evaluate button.
        const tabs = (await browser.tabs.query({currentWindow: true, active: false}));
        const rulesetName = document.getElementById('ruleset').value;
        const viewportSize = trainees.get(rulesetName).viewportSize || {width: 1024, height: 768};
        await setViewportSize(tabs[0], viewportSize.width, viewportSize.height);  // for consistent element sizing in samples due to text wrap, etc.
        const evaluator = new Evaluator(tabs, rulesetName);
        await evaluator.evaluate();
    } finally {
        // Restore UI state, leaving output visible.
        evaluateButton.disabled = false;
    }
}

function empty(element) {
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
}

/**
 * Return [low end, high end] of 95% CI for accuracy using binomial proportion
 * confidence interval formula.
 */
function confidenceInterval(successRatio, numberOfSamples) {
    const z_for_95_percent = 1.96;
    const addend = z_for_95_percent * Math.sqrt(successRatio * (1 - successRatio) / numberOfSamples);
    return [successRatio - addend, Math.min(1, successRatio + addend)];
}

/**
 * Format a ratio as a rounded-off percentage.
 */
function percentify(ratio) {
    return `${(ratio * 100).toFixed(1)}%`;
}

function updateOutputs(coeffs, cost, successesOrFailures) {
    // Update best coeffs and accuracy.
    const coeffStrings = [];
    for (const [key, val] of coeffs.entries()) {
        coeffStrings.push(`${key}: ${val}`);
    }
    gCoeffsDiv.firstChild.textContent = `[${coeffStrings.join(', ')}]`;
    gCostDiv.firstChild.textContent = Math.trunc(cost);

    if (successesOrFailures) {
        // Compute and show accuracy:
        const accuracy = successesOrFailures.reduce((accum, sf) => accum + sf.didSucceed, 0) / successesOrFailures.length;
        gAccuracyDiv.firstChild.textContent = percentify(accuracy);

        // Draw CI readout:
        const [ciLow, ciHigh] = confidenceInterval(accuracy, successesOrFailures.length);
        gCiDiv.firstChild.textContent = `${percentify(ciLow)} - ${percentify(ciHigh)}`;

        // Draw good/bad chart:
        if (gGoodBadDiv.childElementCount !== successesOrFailures.length) {
            empty(gGoodBadDiv);
            for (const _ of successesOrFailures) {
                const div = document.createElement('div');
                div.appendChild(document.createTextNode(''));
                gGoodBadDiv.appendChild(div);
            }
        }
        let div = gGoodBadDiv.firstElementChild;
        const traineeId = document.getElementById('ruleset').value;
        for (let sf of successesOrFailures) {
            div.firstChild.textContent = sf.filename;
            div.addEventListener('click', function focusTab() {
                // Label the bad element if bad, clear it if good:
                browser.tabs.sendMessage(
                    sf.tabId,
                    {type: 'labelBadElement',
                     traineeId,
                     coeffs});
                browser.tabs.update(sf.tabId, {active: true});
                // Update the Fathom dev tools panel if it's open:
                browser.runtime.sendMessage({type: 'refresh'});
            });
            div.setAttribute('class', sf.didSucceed ? 'good' : 'bad');
            div = div.nextElementSibling;
        }
    }
}

/**
 * Draw and outfit the Evaluator page.
 */
async function initPage(document) {
    // Find elements once.
    gCoeffsDiv = document.getElementById('coeffs');
    gAccuracyDiv = document.getElementById('accuracy');
    gCiDiv = document.getElementById('ci');
    gCostDiv = document.getElementById('cost');
    gGoodBadDiv = document.getElementById('goodBad');

    // Initialise elements to a known state.
    empty(gCoeffsDiv);
    empty(gAccuracyDiv);
    empty(gCiDiv);
    empty(gCostDiv);
    empty(gGoodBadDiv);

    // Create a text node in coeffs and accuracy once, rather than on each update.
    gCoeffsDiv.appendChild(document.createTextNode(''));
    gAccuracyDiv.appendChild(document.createTextNode(''));
    gCiDiv.appendChild(document.createTextNode(''));
    gCostDiv.appendChild(document.createTextNode(''));

    document.getElementById('evaluate').onclick = evaluateTabs;

    initRulesetMenu(document.getElementById('evaluate'));
}

initPage(document);
