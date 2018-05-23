//import {Annealer} from 'fathom-web/optimizers';

//import {trainables} from './trainables';


class TabRun {
    constructor(corpus, coeffs) {
        // Send a message to all the pages in the corpus, telling them "Here, run ruleset ID X (which carries its own right/wrong determiner which itself knows what query to run), and tell me whether it was right or wrong."
        
        
        // When all complete, combine for a total score.
    }
}

class Tuner extends Annealer {
    constructor(tabs) {
        super();
        this.corpus = new TabCorpus(tabs);
    }

    solutionCost(coeffs) {
//        const run = TabRun
        return run(this.corpus, coeffs).score();
    }

    randomTransition(solution) {

    }

    initialSolution() {

    }
}

async function trainOnTabs() {
    // Grey out Train button:
    document.getElementById('train').disabled = true;

    // TODO: Using "active" here rather than a tab ID presents a race condition
    // if you quickly switch away from the tab after clicking the Train button.
    const tabs = (await browser.tabs.query({currentWindow: true, active: false}));
    //await setViewportSize(tabs[0], 1024, 768);  // for consistent element sizing in samples due to text wrap, etc.

//     const tuner = new Tuner(tabs);
//     const tunedCoeffs = tuner.anneal();

    // PoC comm with tabs:
    // Send a message to all the pages in the corpus, telling them "Here, run ruleset ID X (which carries its own right/wrong determiner which itself knows what query to run), and tell me whether it was right or wrong."
    for (const tab of tabs) {
        // TODO: Parallelize; don't await each one.
        const succeeded = await browser.tabs.sendMessage(tab.id, {type: 'rulesetSucceeded', trainableId: 'overlay', coeffs: [3]});
        console.log(succeeded);
    }

    // Clean up:
    document.getElementById('train').disabled = false;
}
document.getElementById('train').onclick = trainOnTabs;
