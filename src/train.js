let gProgressBar, gCoeffsDiv, gAccuracyDiv, gCiDiv, gCostDiv, gGoodBadDiv, gPausing = false;

/**
 * Awaitable setDefault that stores Promise values, not the Promises
 * themselves, in the map
 */
async function asyncSetDefault(map, key, asyncDefaultMaker) {
    if (map.has(key)) {
        return map.get(key);
    }
    const defaultValue = await asyncDefaultMaker();
    map.set(key, defaultValue);
    return defaultValue;
}

class Tuner {
    /**
     * @arg isUnpaused Async function that returns only after we should stop
     *     being paused
     */
    constructor(tabs, traineeId, isUnpaused, initialTemperature = 5000, coolingSteps = 5000, coolingFraction = .95, stepsPerTemp = 1000) {
        this.INITIAL_TEMPERATURE = initialTemperature;
        this.COOLING_STEPS = coolingSteps;
        this.COOLING_FRACTION = coolingFraction;
        this.STEPS_PER_TEMP = stepsPerTemp;
        this.BOLTZMANNS = 1.3806485279e-23;

        this.tabs = tabs;
        this.traineeId = traineeId;
        this.isUnpaused = isUnpaused;
    }

    // Copy-and-pasted from Fathom just to allow solutionCost() to be async.
    // What color is your function?
    async anneal(updateProgress, onlyOneStep) {
        console.time('Training');
        let temperature = this.INITIAL_TEMPERATURE;
        let currentSolution = await this.initialSolution();
        let bestSolution = currentSolution;
        let currentCost = await this.solutionCost(currentSolution);
        let bestCost = currentCost;
        updateProgress(0,
                       bestSolution,
                       bestCost,
                       await this.verboseSuccessReports(bestSolution));
        if (onlyOneStep === true) {  // Sometimes this is unintentionally <unavailable> or some other godforsaken truthy value.
            return;
        }
        let m = 0;
        let n = 0;
        for (let i = 0; i < this.COOLING_STEPS; i++) {
            updateProgress(i / this.COOLING_STEPS, bestSolution, bestCost);
            const startCost = currentCost;
            for (let j = 0; j < this.STEPS_PER_TEMP; j++) {
                let newSolution = this.randomTransition(currentSolution);
                let newCost = await this.solutionCost(newSolution);
                if (newCost < currentCost) {
                    // Always take improvements.
                    currentCost = newCost;
                    currentSolution = newSolution;
                    if (newCost < bestCost) {
                        bestCost = newCost;
                        bestSolution = newSolution;
                        updateProgress(i / this.COOLING_STEPS,
                                       bestSolution,
                                       bestCost,
                                       await this.verboseSuccessReports(bestSolution));
                    }
                } else {
                    // Sometimes take non-improvements. We're more likely to
                    // take ones that aren't too much worse.
                    const minusDelta = currentCost - newCost;
                    const merit = Math.exp(minusDelta / (this.BOLTZMANNS * temperature));
                    if (merit > Math.random()) {
                        m++;
                        currentCost = newCost;
                        currentSolution = newSolution;
                    }
                }
                n++;

                await this.isUnpaused();
                // Exit if we're not moving:
                if (startCost === currentCost) {
                    break;
                }
            }
            temperature *= this.COOLING_FRACTION;
        }
        console.timeEnd('Training');
        console.log('Iterations:', n, 'using', m, 'jumps.');
    }

    /**
     * Try the ruleset on each tab, and return a bigger blob of info that
     * allows us to show the user which element it found, for debugging.
     */
    async verboseSuccessReports(coeffs) {
        return (await this.resultsForPages(coeffs)).map((result, i) => ({
            didSucceed: result.didSucceed,
            filename: urlFilename(this.tabs[i].url),
            tabId: this.tabs[i].id}));
    }

    /**
     * Send a message to all the pages in the corpus, telling them "Run ruleset
     * ID X, and tell me how its default query (the one with the same out() key
     * as its ID) did." Do it by delegating to the Fathom Trainees webext,
     * where user rulesets are developed.
     *
     * @return an Array of {didSucceed: bool, cost: number} objects, one per
     *     page
     */
    async resultsForPages(coeffs) {
        return await browser.runtime.sendMessage(
            'fathomtrainees@mozilla.com',
            {type: 'rulesetSucceededOnTabs',
             tabIds: this.tabs.map(tab => tab.id),
             traineeId: this.traineeId,
             coeffs: Array.from(coeffs.entries())});
    }

    async solutionCost(coeffs) {
        const attempts = await this.resultsForPages(coeffs);
        const totalCost = attempts.reduce((accum, value) => accum + value.cost, 0);
        return totalCost;
    }

    /** Nudge a random coefficient in a random direction. */
    randomTransition(coeffs) {
        const keys = Array.from(coeffs.keys());
        let newValue, key;
        do {
            const index = Math.floor(Math.random() * keys.length);
            key = keys[index];
            const direction = Math.floor(Math.random() * 2) ? -1 : 1;
            newValue = coeffs.get(key) + direction;
        } while (newValue < 0);
        coeffs.set(key, newValue);
        return coeffs;
    }

    positiveInts(coeffs) {
        // It finds the optima really fast. It makes me want to try giving this
        // a larger space to work in, perhaps with non-integral values.

        // We don't nudge by a percentage of the current value because then we
        // never have any cache hits. Witness: x' := x + x*0.5. x' - x'*0.5 != x.
        const ret = coeffs.slice();
        let newValue, element;
        do {
            element = Math.floor(Math.random() * coeffs.length);
            const direction = Math.floor(Math.random() * 2) ? -1 : 1;
            newValue = ret[element] + direction;
        } while (newValue < 0);
        ret[element] = newValue;
        return ret;
    }

    async initialSolution() {
        return (await browser.runtime.sendMessage(
            'fathomtrainees@mozilla.com',
            {type: 'trainee',
             traineeId: this.traineeId})).coeffs;
    }
}

async function sleepUntilUnpaused() {
    while (gPausing) {
        await sleep(500);
    }
}

function pauseOrResume() {
    gPausing = !gPausing;
    document.getElementById('pause').disabled = gPausing;
    document.getElementById('train').disabled = !gPausing;
}

async function trainOnTabs(onlyOneStep) {
    // Grey out Train button:
    const trainButton = document.getElementById('train');
    trainButton.disabled = true;
    trainButton.onclick = pauseOrResume;
    const oneStepButton = document.getElementById('onlyOneStep');
    oneStepButton.disabled = true;
    document.getElementById('pause').disabled = false;

    // Show progress bar and output.
    gProgressBar.classList.remove('hidden');
    document.getElementById('output').classList.remove('hidden');

    try {
        // TODO: Using "active" here rather than a tab ID presents a race condition
        // if you quickly switch away from the tab after clicking the Train button.
        const tabs = (await browser.tabs.query({currentWindow: true, active: false}));
        const rulesetName = document.getElementById('ruleset').value;
        const viewportSize = (await browser.runtime.sendMessage(
            'fathomtrainees@mozilla.com',
            {type: 'trainee',
             traineeId: rulesetName})).viewportSize || {width: 1024, height: 768};
        await setViewportSize(tabs[0], viewportSize.width, viewportSize.height);  // for consistent element sizing in samples due to text wrap, etc.
        const tuner = new Tuner(tabs, rulesetName, sleepUntilUnpaused);
        await tuner.anneal(updateProgress, onlyOneStep);
    } finally {
        // Restore UI state, leaving output visible.
        gProgressBar.classList.add('hidden');
        gProgressBar.setAttribute('value', 0);
        trainButton.onclick = trainOnTabs;
        document.getElementById('pause').disabled = true;
        trainButton.disabled = false;
        oneStepButton.disabled = false;
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

function updateProgress(ratio, bestSolution, bestCost, successesOrFailures) {
    // Tick progress meter.
    gProgressBar.setAttribute('value', ratio);

    // Update best coeffs and accuracy.
    const bestCoeffs = [];
    for (const [key, val] of bestSolution.entries()) {
        bestCoeffs.push(`${key}: ${val}`);
    }
    gCoeffsDiv.firstChild.textContent = `[${bestCoeffs.join(', ')}]`;
    gCostDiv.firstChild.textContent = Math.trunc(bestCost);

    if (successesOrFailures) {
        // Compute and show accuracy:
        const bestAccuracy = successesOrFailures.reduce((accum, sf) => accum + sf.didSucceed, 0) / successesOrFailures.length;
        gAccuracyDiv.firstChild.textContent = percentify(bestAccuracy);

        // Draw CI readout:
        const [ciLow, ciHigh] = confidenceInterval(bestAccuracy, successesOrFailures.length);
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
                browser.runtime.sendMessage(
                    'fathomtrainees@mozilla.com',
                    {type: 'labelBadElement',
                     tabId: sf.tabId,
                     traineeId,
                     coeffs: bestSolution});
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
 * Draw and outfit the Train page.
 */
async function initPage(document) {
    // Find elements once.
    gProgressBar = document.getElementById('progress');
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

    document.getElementById('train').onclick = () => trainOnTabs(false);
    document.getElementById('onlyOneStep').onclick = () => trainOnTabs(true);
    document.getElementById('pause').onclick = pauseOrResume;

    initRulesetMenu(document.getElementById('train'));
}

initPage(document);
