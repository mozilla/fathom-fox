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
    constructor(tabs, traineeId, initialTemperature = 5000, coolingSteps = 5000, coolingFraction = .95, stepsPerTemp = 1000) {
        this.INITIAL_TEMPERATURE = initialTemperature;
        this.COOLING_STEPS = coolingSteps;
        this.COOLING_FRACTION = coolingFraction;
        this.STEPS_PER_TEMP = stepsPerTemp;
        this.BOLTZMANNS = 1.3806485279e-23;

        this.tabs = tabs;
        this.traineeId = traineeId;
    }

    // Copy-and-pasted from Fathom just to allow solutionCost() to be async.
    // What color is your function?
    async anneal(updateProgress) {
        let temperature = this.INITIAL_TEMPERATURE;
        let currentSolution = await this.initialSolution();
        let bestSolution = currentSolution;
        let currentCost = await this.solutionCost(currentSolution);
        let bestCost = currentCost;
        updateProgress(0,
                       bestSolution,
                       bestCost,
                       (await this.whetherTabsSucceeded(bestSolution)).map((succeeded, i) => [succeeded, urlFilename(this.tabs[i].url)]));
        let m = 0;
        let n = 0;
        let hits = 0, misses = 0;
        const seenSolutions = new Map();  // solution => cost
        for (let i = 0; i < this.COOLING_STEPS; i++) {
            //const startMillis = (new Date()).getMilliseconds();
            //const solutionsPerSecond = 
            updateProgress(i / this.COOLING_STEPS, bestSolution, bestCost);
            const startCost = currentCost;
            for (let j = 0; j < this.STEPS_PER_TEMP; j++) {
                let newSolution = this.randomTransition(currentSolution);
                if (seenSolutions.has(newSolution.toString())) {
                    hits += 1;
                } else {
                    misses += 1;
                }
                let newCost = await asyncSetDefault(seenSolutions, newSolution.toString(), () => this.solutionCost(newSolution));

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
                                       (await this.whetherTabsSucceeded(bestSolution)).map((succeeded, i) => [succeeded, urlFilename(this.tabs[i].url)]));
                    }
                } else {
                    // Sometimes take non-improvements.
                    const minusDelta = currentCost - newCost;
                    const merit = Math.exp(minusDelta / (this.BOLTZMANNS * temperature));
                    if (merit > Math.random()) {
                        m++;
                        currentCost = newCost;
                        currentSolution = newSolution;
                    }
                }
                n++;
                // Exit if we're not moving:
                if (startCost === currentCost) { break; }
            }
            temperature *= this.COOLING_FRACTION;
        }
        console.log('Iterations:', n, 'using', m, 'jumps.');
        console.log('Cache hits', hits, 'misses', misses);
        console.log('Cache hit rate', hits/(hits + misses));
        return [bestSolution, bestCost];
    }

    /**
     * Send a message to all the pages in the corpus, telling them "Run ruleset
     * ID X, and tell me whether its default query (the one with the same out()
     * key as its ID) was right or wrong." Do it by delegating to the FathomFox
     * Rulesets webext, where user rulesets are developed.
     */
    async whetherTabsSucceeded(coeffs) {
        return await browser.runtime.sendMessage(
            'fathomtrainees@mozilla.com',
            {type: 'rulesetSucceededOnTabs',
             tabIds: this.tabs.map(tab => tab.id),
             traineeId: this.traineeId,
             coeffs});
    }

    async solutionCost(coeffs) {
        const attempts = await this.whetherTabsSucceeded(coeffs);
        const numSuccesses = attempts.reduce((accum, value) => value ? accum + 1 : accum, 0);

        //console.log(coeffs, attempts.reduce((failedUrls, didSucceed, i) => didSucceed ? failedUrls : (failedUrls + this.tabs[i].url + '\n'), []));

        // When all complete, combine for a total cost:
        return (attempts.length - numSuccesses) / attempts.length;
    }

    /** Nudge a random coefficient in a random direction. */
    randomTransition(coeffs) {
        // It finds the optima really fast. It makes me want to try giving this
        // a larger space to work in, perhaps with non-integral values.

        // We don't nudge by a percentage of the current value because then we
        // never have any cache hits. Witness: x' := x + x*0.5. x' - x'*0.5 != x.
        const ret = coeffs.slice();
        const element = Math.floor(Math.random() * coeffs.length);

        // Make coeffs <1 possible. Someday, maybe make the nudges smaller when
        // the value is less, because things go more exponential there.
        const direction = Math.floor(Math.random() * 2) ? -1 : 1;
        ret[element] += direction;
        return ret;
    }

    async initialSolution() {
        return await browser.runtime.sendMessage(
            'fathomtrainees@mozilla.com',
            {type: 'traineeCoeffs',
             traineeId: this.traineeId});
    }
}

async function trainOnTabs() {
    // Grey out Train button:
    const trainButton = document.getElementById('train');
    trainButton.disabled = true;
    const progressBar = document.getElementById('progress');
    progressBar.setAttribute('style', '');

    // TODO: Using "active" here rather than a tab ID presents a race condition
    // if you quickly switch away from the tab after clicking the Train button.
    const tabs = (await browser.tabs.query({currentWindow: true, active: false}));
    await setViewportSize(tabs[0], 1024, 768);  // for consistent element sizing in samples due to text wrap, etc.

    const rulesetName = document.getElementById('ruleset').value;
    const tuner = new Tuner(tabs, rulesetName);
    const [tunedCoeffs, tunedCost] = await tuner.anneal(updateProgress);

    progressBar.setAttribute('style', 'display: none');
    progressBar.setAttribute('value', 0);
    trainButton.disabled = false;
}

function empty(element) {
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
}

function updateProgress(ratio, bestSolution, bestCost, successesOrFailures) {
    document.getElementById('progress').setAttribute('value', ratio);

    // Update best coeffs and accuracy:
    const coeffsDiv = document.getElementById('coeffs');
    const accuracyDiv = document.getElementById('accuracy');
    Array.prototype.forEach.call(document.getElementsByClassName('output'),
                                 e => e.classList.remove('output'));
    coeffsDiv.classList.remove('output');
    empty(coeffsDiv);
    empty(accuracyDiv);
    coeffsDiv.appendChild(document.createTextNode(`[${bestSolution}]`));
    accuracyDiv.appendChild(document.createTextNode(`${((1 - bestCost) * 100).toFixed(1)}%`));
    if (successesOrFailures) {
        const goodBadDiv = document.getElementById('goodBad');
        empty(goodBadDiv);
        for (let [succeeded, name] of successesOrFailures) {
            const newDiv = document.createElement('div');
            newDiv.appendChild(document.createTextNode(name));
            newDiv.setAttribute('class', succeeded ? 'good' : 'bad');
            goodBadDiv.appendChild(newDiv);
        }
    }
}

/**
 * Draw and outfit the Train page.
 */
async function initPage(document) {
    document.getElementById('train').onclick = trainOnTabs;

    // Ruleset menu:
    const traineeKeys = await browser.runtime.sendMessage(
        'fathomtrainees@mozilla.com',
        {type: 'traineeKeys'});
    const menu = document.getElementById('ruleset');
    for (const traineeKey of traineeKeys) {
        const option = document.createElement('option');
        option.text = option.value = traineeKey;
        menu.add(option);
    }
}

initPage(document);
