let gProgressBar, gCoeffsDiv, gAccuracyDiv, gGoodBadDiv;

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
        console.time('Training');
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
        console.timeEnd('Training');
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
        return (await browser.runtime.sendMessage(
            'fathomtrainees@mozilla.com',
            {type: 'trainee',
             traineeId: this.traineeId})).coeffs;
    }
}

async function trainOnTabs() {
    // Grey out Train button:
    const trainButton = document.getElementById('train');
    trainButton.disabled = true;

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
        const tuner = new Tuner(tabs, rulesetName);
        await tuner.anneal(updateProgress);
    } finally {
        // Restore UI state, leaving output visible.
        gProgressBar.classList.add('hidden');
        gProgressBar.setAttribute('value', 0);
        trainButton.disabled = false;
    }
}

function empty(element) {
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
}

function updateProgress(ratio, bestSolution, bestCost, successesOrFailures) {
    // Tick progress meter.
    gProgressBar.setAttribute('value', ratio);

    // Update best coeffs and accuracy.
    gCoeffsDiv.firstChild.textContent = `[${bestSolution}]`;
    gAccuracyDiv.firstChild.textContent = `${((1 - bestCost) * 100).toFixed(1)}%`;

    if (successesOrFailures) {
        if (gGoodBadDiv.childElementCount !== successesOrFailures.length) {
            empty(gGoodBadDiv);
            for (const _ of successesOrFailures) {
                const div = document.createElement('div');
                div.appendChild(document.createTextNode(''));
                gGoodBadDiv.appendChild(div);
            }
        }

        let div = gGoodBadDiv.firstElementChild;
        for (let [succeeded, name] of successesOrFailures) {
            div.firstChild.textContent = name;
            div.setAttribute('class', succeeded ? 'good' : 'bad');
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
    gGoodBadDiv = document.getElementById('goodBad');

    // Initialise elements to a known state.
    empty(gCoeffsDiv);
    empty(gAccuracyDiv);
    empty(gGoodBadDiv);

    // Create a text node in coeffs and accuracy once, rather than on each update.
    gCoeffsDiv.appendChild(document.createTextNode(''));
    gAccuracyDiv.appendChild(document.createTextNode(''));

    document.getElementById('train').onclick = trainOnTabs;

    // Draw Ruleset menu:
    let traineeKeys;
    try {
        traineeKeys = await browser.runtime.sendMessage(
            'fathomtrainees@mozilla.com',
            {type: 'traineeKeys'});
    } catch (e) {
        // Fathom Trainees webext is absent.
        traineeKeys = [];
    }
    const menu = document.getElementById('ruleset');
    if (traineeKeys.length) {
        for (const traineeKey of traineeKeys) {
            const option = document.createElement('option');
            option.text = option.value = traineeKey;
            menu.add(option);
        }
    } else {
        const trainButton = document.getElementById('train');
        trainButton.disabled = true;
        menu.disabled = true;
        document.getElementById('please-install').classList.remove('hidden');
    }
}

initPage(document);
