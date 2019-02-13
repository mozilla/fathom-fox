class CorpusCollector extends PageVisitor {
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
        const vector = await browser.runtime.sendMessage(
            'fathomtrainees@mozilla.com',
            {type: 'vectorizeTab',
             tabId: tab.id,
             traineeId: this.otherOptions.traineeId});

        // Save vector to disk. TODO: collect vectors and save all in one file.
        let download_filename = await download(JSON.stringify(vector),
                                               {filename: 'vectors.json'});

        this.setCurrentStatus({message: 'vectorized as ' + download_filename, isFinal: true});
    }
}

const collector = new CorpusCollector(document);
collector.addEventListeners();

initRulesetMenu(document.getElementById('freeze'));
