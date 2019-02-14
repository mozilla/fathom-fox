class CorpusCollector extends PageVisitor {
    constructor(document) {
        super(document);
    }

    formOptions() {
        const options = {};

        // Initialize options from the form.
        options.viewportWidth = parseInt(this.doc.getElementById('viewportWidth').value);
        options.viewportHeight = parseInt(this.doc.getElementById('viewportHeight').value);

        options.timeout = 9999;  // effectively none

        // Load each url line-by-line from the textarea.
        // If a line contains a space, the first word will be used as the filename.
        options.urls = this.doc
            .getElementById('pages')
            .value
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .map(line => ({filename: undefined, url: line}));

        // We need at least one url.
        if (options.urls.length === 0) {
            return undefined;
        }

        options.otherOptions = {'traineeId': this.doc.getElementById('ruleset').value};
        return options;
    }

    async processWithinTimeout(tab) {
        // Have fathom-trainees vectorize the page:
        let vector = undefined;
        while (vector === undefined) {
            try {
                vector = await browser.runtime.sendMessage(
                    'fathomtrainees@mozilla.com',
                    {type: 'vectorizeTab',
                     tabId: tab.id,
                     traineeId: this.otherOptions.traineeId});
            } catch {
                await sleep(1000);
            }
        }
        this._vectors.push(vector);
        this.setCurrentStatus({message: 'vectorized', isFinal: true});
    }

    processAtBeginningOfRun() {
        this._vectors = [];
    }

    async processAtEndOfRun() {
        // Save vectors to disk.
        await download(JSON.stringify(this._vectors), {filename: 'vectors.json'});
    }
}

const collector = new CorpusCollector(document);
collector.addEventListeners();

initRulesetMenu(document.getElementById('freeze'));
