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
    constructor(tabs, trainableId, initialTemperature = 5000, coolingSteps = 5000, coolingFraction = .95, stepsPerTemp = 1000) {
        this.INITIAL_TEMPERATURE = initialTemperature;
        this.COOLING_STEPS = coolingSteps;
        this.COOLING_FRACTION = coolingFraction;
        this.STEPS_PER_TEMP = stepsPerTemp;
        this.BOLTZMANNS = 1.3806485279e-23;

        this.tabs = tabs;
        this.trainableId = trainableId;
    }

    // Copy-and-pasted from Fathom just to allow solutionCost() to be async.
    // What color is your function?
    async anneal(updateProgress) {
        let temperature = this.INITIAL_TEMPERATURE;
        let currentSolution = this.initialSolution();
        let bestSolution = currentSolution;
        let currentCost = await this.solutionCost(currentSolution);
        let bestCost = currentCost;
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
                        updateProgress(i / this.COOLING_STEPS, bestSolution, bestCost);
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

    async solutionCost(coeffs) {
        // Send a message to all the pages in the corpus, telling them "Run
        // ruleset ID X, and tell me whether its default query (the one with
        // the same out() key as its ID) was right or wrong."
        const attempts = await Promise.all(this.tabs.map(
            tab => browser.tabs.sendMessage(tab.id,
                                            {type: 'rulesetSucceeded',
                                             trainableId: this.trainableId,
                                             coeffs})));
        const numSuccesses = attempts.reduce((accum, value) => value ? accum + 1 : accum, 0);

        //console.log(coeffs, attempts.reduce((failedUrls, didSucceed, i) => didSucceed ? failedUrls : (failedUrls + this.tabs[i].url + '\n'), ''));

        // When all complete, combine for a total cost:
        return (attempts.length - numSuccesses) / attempts.length;
    }

    /** Nudge a random coefficient in a random direction. */
    randomTransition(coeffs) {
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

    initialSolution() {
        return [1, 0, 4];  // 62.5% accuracy with exponentiation-based weights
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

function updateProgress(ratio, bestSolution, bestCost) {
    document.getElementById('progress').setAttribute('value', ratio);

    // Update best coeffs and accuracy:
    const coeffsDiv = document.getElementById('coeffs');
    if (coeffsDiv.firstChild) {
        coeffsDiv.removeChild(coeffsDiv.firstChild);
    }
    coeffsDiv.appendChild(document.createTextNode(`Best coefficients so far: [${bestSolution}], yielding ${((1 - bestCost) * 100).toFixed(1)}% accuracy`));
}

/**
 * Draw and outfit the Train page.
 */
function initPage(document) {
    document.getElementById('train').onclick = trainOnTabs;

    // Ruleset menu:
    const menu = document.getElementById('ruleset');
    for (const trainableKey of trainables.keys()) {
        const option = document.createElement('option');
        option.text = option.value = trainableKey;
        menu.add(option);
    }
}

initPage(document, trainables);