class CorpusCollector extends PageVisitor {
    constructor(document) {
        super(document);
    }

    formOptions() {
        const options = {};

        // Initialize options from the form.
        options.timeout = 9999;  // effectively none

        // Load each url line-by-line from the textarea.
        const prefix = this.doc.getElementById('baseUrl').value;
        options.urls = this.doc
            .getElementById('pages')
            .value
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .map(line => ({filename: undefined, url: prefix + line}));

        // We need at least one url.
        if (options.urls.length === 0) {
            return undefined;
        }

        options.otherOptions = {
            traineeId: this.doc.getElementById('ruleset').value,
            wait: parseInt(this.doc.getElementById('wait').value),
            retryOnError: this.doc.getElementById('retryOnError').checked
        };
        return options;
    }

    async processWithinTimeout(tab) {
        // Have fathom-trainees vectorize the page:
        let vector = undefined;
        let tries = 0;
        const maxTries = this.otherOptions.retryOnError ? 10 : 1;
        while (vector === undefined) {
            try {
                tries++;
                await sleep(this.otherOptions.wait * 1000);
                vector = await browser.runtime.sendMessage(
                    'fathomtrainees@mozilla.com',
                    {type: 'vectorizeTab',
                     tabId: tab.id,
                     traineeId: this.otherOptions.traineeId});
            } catch (error) {
                // We often get a "receiving end does not exist", even though
                // the receiver is a background script that should always be
                // registered. The error goes away on retrying.
                if (tries >= maxTries) {  // 3 is not enough.
                    this.setCurrentStatus({message: 'failed: ' + error, isError: true, isFinal: true});
                    break;
                } else {
                    await sleep(1000);
                }
            }
        }
        if (vector !== undefined) {
            this._vectors.push(vector);
            this.setCurrentStatus({message: 'vectorized', isFinal: true});
        }
    }

    processAtBeginningOfRun() {
        this._vectors = [];
    }

    async processAtEndOfRun() {
        const trainee = await browser.runtime.sendMessage(
            'fathomtrainees@mozilla.com',
            {type: 'trainee',
             traineeId: this.otherOptions.traineeId});

        // Save vectors to disk.
        await download(JSON.stringify(
                {
                    header: {
                        version: 1,
                        featureNames: Array.from(trainee.coeffs.keys())
                    },
                    pages: this._vectors
                }
            ),
            {filename: 'vectors.json'}
        );
    }
}

const collector = new CorpusCollector(document);
collector.addEventListeners();

initRulesetMenu(document.getElementById('freeze'));
