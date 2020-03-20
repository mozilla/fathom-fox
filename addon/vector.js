class CorpusCollector extends PageVisitor {
    constructor(document) {
        super(document);

        this.trainee = undefined;
        this.traineeId = undefined;
        this.vectors = [];
    }

    formOptions() {
        const options = {};

        // Initialize options from the form.
        options.timeout = 9999;  // effectively none

        // Load each url line-by-line from the textarea.
        let prefix = this.doc.getElementById('baseUrl').value;
        if (!prefix.endsWith('/')) {
            prefix += '/';
        }
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
            wait: parseInt(this.doc.getElementById('wait').value),
            retryOnError: this.doc.getElementById('retryOnError').checked
        };

        return options;
    }

    getViewportHeightAndWidth() {
        // Pull the viewport size from the loaded trainee.
        return {
            height: this.trainee.viewportSize.height,
            width: this.trainee.viewportSize.width
        }
    }

    async processWithinTimeout(tab, windowId) {
        this.setCurrentStatus({message: 'vectorizing', index: tab.id});
        // Have the content script vectorize the page:
        let vector = undefined;
        let tries = 0;
        const maxTries = this.otherOptions.retryOnError ? 100 : 1;  // 10 is not enough.
        while (vector === undefined) {
            try {
                tries++;
                await browser.tabs.update(
                  tab.id,
                  {active: true}
                );
                await sleep(this.otherOptions.wait * 1000);
                vector = await browser.tabs.sendMessage(tab.id, {type: 'vectorizeTab', traineeId: this.traineeId});
            } catch (error) {
                // We often get a "receiving end does not exist", even though
                // the receiver is a background script that should always be
                // registered. The error goes away on retrying.
                if (tries >= maxTries) {
                    this.errorAndStop(`failed: ${error}`, tab.id, windowId);
                    break;
                } else {
                    await sleep(2000);
                }
            }
        }
        if (vector !== undefined) {
            this.vectors.push(vector);

            // Check if any of the rules didn't run or returned null.
            // This presents as an undefined value in a feature vector.
            const nullFeatures = this.nullFeatures(vector.nodes);
            if (nullFeatures) {
                this.errorAndStop(`failed: rule(s) ${nullFeatures} returned null values`, tab.id, windowId);
            } else {
                this.setCurrentStatus({
                    message: 'vectorized',
                    index: tab.id,
                    isFinal: true
                });
            }
        }
    }

    nullFeatures(nodes) {
        for (const node of nodes) {
            if (node.features.some(featureValue => featureValue === undefined)) {
                const featureNames = Array.from(this.trainee.coeffs.keys());
                return node.features.reduce((nullFeatures, featureValue, index) => {
                    if (featureValue === undefined) {
                        nullFeatures.push(featureNames[index]);
                    }
                    return nullFeatures;
                }, []);
            }
        }
    }

    async processAtBeginningOfRun() {
        this.vectors = [];
        this.traineeId = this.doc.getElementById('ruleset').value;
        this.trainee = trainees.get(this.traineeId);
    }

    async processAtEndOfRun() {
        function compareByKey(key) {
            function cmp(a, b) {
                const keyA = key(a);
                const keyB = key(b);
                return (keyA < keyB) ? -1 : ((keyA > keyB) ? 1 : 0);
            }
            return cmp;
        }

        // Sort by filename so they come out in a deterministic order. This is
        // handy for comparing vectors with teammates for troubleshooting.
        this.vectors.sort(compareByKey(item => item['filename']));

        // Save vectors to disk.
        await download(JSON.stringify(
                {
                    header: {
                        version: 1,
                        featureNames: Array.from(this.trainee.coeffs.keys())
                    },
                    pages: this.vectors
                }
            ),
            {filename: 'vectors.json'}
        );
    }
}

const collector = new CorpusCollector(document);
collector.addEventListeners();

initRulesetMenu(document.getElementById('freeze'));
