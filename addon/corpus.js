class CorpusCollector extends PageVisitor {
    formOptions() {
        if (!(this.doc.getElementById('wait').validity.valid &&
              this.doc.getElementById('timeout').validity.valid)) {
            return undefined;
        }

        const options = {};

        // Initialize options from the form.
        options.otherOptions = {
            wait: parseFloat(this.doc.getElementById('wait').value),
            shouldScroll: this.doc.getElementById('shouldScroll').checked,
        };

        // Note we extend the timeout by the freeze delay.
        options.timeout = parseFloat(this.doc.getElementById('timeout').value) + options.otherOptions.wait;

        // Load each url line-by-line from the textarea.
        // If a line contains a space, the first word will be used as the filename.
        options.urls = this.doc
            .getElementById('pages')
            .value
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .map(line => {
                // Split into filename and url.
                const parts = line.split(/\s+/, 2);
                let obj;
                if (parts.length === 1) {
                    obj = {filename: undefined, url: parts[0]};
                } else {
                    obj = {filename: parts[0] + '.html', url: parts[1]};
                }
                // Prepend protocol if missing.
                if (!obj.url.match(/^https?:\/\//)) {
                    obj.url = 'http://' + obj.url;
                }
                // Name the file from the host if not specified.
                if (!obj.filename) {
                    obj.filename = obj.url
                        .replace(/^https?:\/\//, '')  // Remove protocol.
                        .replace(/^([^\/]+)\/.*$/, '$1')  // Delete everything after first /
                        + '.html';
                }
                return obj;
            });
        // We need at least one url.
        if (options.urls.length === 0) {
            return undefined;
        }
        return options;
    }

    getViewportHeightAndWidth() {
        return {
            height: parseInt(this.doc.getElementById('viewportHeight').value),
            width: parseInt(this.doc.getElementById('viewportWidth').value)
        }
    }

    async processWithinTimeout(tab, windowId) {
        this.setCurrentStatus({message: 'freezing', index: tab.id});
        // Inject dispatcher to listen to the message we then send. Can't get a
        // return value directly out of the content script because webpack
        // wraps our top-level stuff in a function. Instead, we use messaging.
        await browser.tabs.executeScript(
            tab.id,
            {file: '/contentScript.js'}
        );

        // Call freeze-dry to fetch html.
        const html = await browser.tabs.sendMessage(
            tab.id,
            {type: 'freeze', options: {wait: this.otherOptions.wait,
                                       shouldScroll: this.otherOptions.shouldScroll}}
        );
        return html;
    }

    async processWithoutTimeout(html, tabId) {
        // Save html to disk.
        const filename = this.urls[this.tabIdToUrlsIndex.get(tabId)].filename;
        const download_filename = await download(html, {filename});

        this.setCurrentStatus({
          message: 'downloaded as ' + download_filename,
          index: tabId,
          isFinal: true
        });
    }
}

const collector = new CorpusCollector(document);
collector.addEventListeners();
