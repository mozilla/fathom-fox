// Framework for loading a series of pages one at a time and doing something to
// them

class PageVisitor {
    constructor(document) {
        this.urls =[];  // Array of {filename, url} to visit
        this.tabIdToUrlsIndex = new Map();  // Maps tab IDs to an index in this.urls
        this.urlIndex = undefined;  // index of current URL in this.urls
        this.tabsDone = undefined;
        this.maxTabs = 16;
        this.timeout = undefined;
        this.viewportWidth = undefined;
        this.viewportHeight = undefined;
        this.tabUpdateListener = undefined;
        this.otherOptions = undefined;
        this.doc = document;
    }

    addEventListeners() {
        this.doc.addEventListener('fathom:start', this.start.bind(this), false);
        this.doc.addEventListener('fathom:next', this.next.bind(this), false);
        this.doc.addEventListener('fathom:visitPage', this.visitPage.bind(this), false);
        this.doc.addEventListener('fathom:done', this.done.bind(this), false);
        this.doc.getElementById('pages').addEventListener('keyup', this.setButtonEnabled.bind(this));
        this.doc.getElementById('freeze').onclick = this.visitAllPages.bind(this);
        this.setButtonEnabled();
    }

    setButtonEnabled() {
        this.doc.getElementById('freeze').disabled = this.formOptions() === undefined;
    }

    async visitAllPages(event) {
        const visitor = this;
        event.preventDefault();

        await this.processAtBeginningOfRun();

        const options = this.formOptions();
        if (options === undefined) {
            return;
        }
        this.urls = options.urls;
        this.timeout = options.timeout;
        this.otherOptions = options.otherOptions;

        const viewportSize = this.getViewportHeightAndWidth();
        this.viewportHeight = viewportSize.height;
        this.viewportWidth = viewportSize.width;

        emptyElement(document.getElementById('status'));

        this.doc.getElementById('freeze').disabled = true;
        let windowId = 'uninitialized window ID';
        this.urlIndex = -1;
        this.tabsDone = 0;
        this.maxTabs = Math.min(this.maxTabs, this.urls.length);

        // Listen for tab events before we start creating tabs; this avoids race
        // conditions between creating tabs and waiting for loading to complete.
        async function onUpdated(tabId, changeInfo, tab) {
            if (tab.windowId !== windowId ||
                tab.url === 'about:blank' ||
                tab.url === 'about:newtab' ||
                tab.status !== 'complete' ||
                changeInfo.status !== 'complete'  // Avoid the several other update events about things like "attention" that fire on every page.
            ) {
                return;
            }

            if (tab.url.startsWith('moz-extension://')) {
                // The blank placeholder page has loaded. Set its viewport size to
                // a standard dimension. This is done as part of onUpdated()
                // because calling executeScript() (within setViewportSize) before
                // the tab is fully ready leads to an error. See
                // https://bugzilla.mozilla.org/show_bug.cgi?id=1397667.
                await setViewportSize(tab, visitor.viewportWidth, visitor.viewportHeight);
                // The start the freezing process.
                visitor.doc.dispatchEvent(new CustomEvent(
                    'fathom:start',
                    {detail: windowId}
                ));
            } else {
                // Tab that needs to be frozen has loaded.

                // Set up the timeout; this covers both the page load and processing time.
                const timer = setTimeout(timeout, visitor.timeout * 1000);
                async function timeout() {
                    console.error(tab.url, 'timeout');
                    clearTimeout(timer);
                    visitor.setCurrentStatus({
                        message: 'timeout',
                        index: tab.id,
                        isFinal: true,
                        isError: true
                    });
                    // Stop everything (no point in continuing if we have an error)
                    visitor.doc.dispatchEvent(new CustomEvent(
                      'fathom:done',
                      {detail: {windowId: windowId, success: false}}
                    ));
                }

                // Process this page.
                visitor.doc.dispatchEvent(new CustomEvent(
                  'fathom:visitPage',
                  {detail: {windowId: windowId, timer: timer, tabId: tab.id}}
                ));
            }
        }
        this.tabUpdateListener = onUpdated;
        browser.tabs.onUpdated.addListener(onUpdated);

        // Make freezing host window, and set its size. The blank page acts as a
        // placeholder so we don't have to repeatedly (and slowly) open and close
        // the window.
        windowId = (await browser.windows.create({url: '/pages/blank.html'})).id;
    }

    // Start processing by triggering ``maxTabs`` next events. This will load
    // a URL for each event and begin visiting pages in parallel.
    async start(event) {
        const windowId = event.detail;
        for (let i = 0; i < this.maxTabs; i++) {
            this.doc.dispatchEvent(new CustomEvent(
              'fathom:next',
              {detail: windowId}
            ));
        }
    }

    // Load next tab from this.urls, or close the window if we're done.
    async next(event) {
        const windowId = event.detail;

        if (this.urlIndex < this.urls.length - 1) {
            this.urlIndex++;
            // Capture the current urlIndex here so we can rely on its value in
            // the success callback for ``browser.tabs.create()``.
            const urlIndexForMap = this.urlIndex;
            // Create a new tab with the current url.
            // The tabs.onUpdated handler in visitAllPages() will dispatch a
            // fathom:freeze event when the tab has completed loading.
            browser.tabs.create({
                windowId: windowId,
                url: this.urls[this.urlIndex].url,
                active: false,
            }).then(tab => {
                this.tabIdToUrlsIndex.set(tab.id, urlIndexForMap);
                this.setCurrentStatus({message: 'loading', index: tab.id});
            }).catch(error => {
                // TODO: How to handle a failure in loading the tab since we
                // won't have a status item to display an error for?
                console.error(error);
            });
        } else {
            // We cannot immediately assume we're done because there may still
            // be some tabs that need to finish up their last url.
            this.tabsDone++;
            if (this.tabsDone === this.maxTabs) {
                this.doc.dispatchEvent(new CustomEvent(
                  'fathom:done',
                  {detail: {windowId: windowId, success: true}}
                ));
            }
        }
    }

    // A page to be frozen has finished loading. Do something to it.
    async visitPage(event) {
        const windowId = event.detail.windowId;
        const timer = event.detail.timer;
        const tab = (await browser.tabs.get(event.detail.tabId));

        try {
            const result = await this.processWithinTimeout(tab, windowId);

            // Clear timeout here so we don't bail out while writing to disk:
            clearTimeout(timer);

            await this.processWithoutTimeout(result, tab.id);
        } catch (e) {
            clearTimeout(timer);
            // Beware: control flow can pass from the very end of the `try` block
            // above to here, for example when "Message manager disconnected"
            // happens in a tab we just froze. This is the motivation behind the
            // isFinal option of setCurrentStatus().
            console.error(tab.url, e.message);
            // When the tab is closed while things are processing we get errors that
            // are less than informative and require rewriting to be grokable.
            let error = e.message;
            if (error === "can't access dead object") {
                error = "unexpected removal of DOM element (can't access dead object). Try a longer freeze delay.";
            } else if (e.message === 'Message manager disconnected') {
                error = "tab unexpectedly closed (message manager disconnected)";
            }
            this.errorAndStop(`freezing failed: ${error}`, tab.id, windowId);
        }

        await browser.tabs.remove(tab.id);
        // Done with this url, trigger loading of the next.
        this.doc.dispatchEvent(new CustomEvent(
          'fathom:next',
          {detail: windowId}
        ));
    }

    // Do final cleanup and close the window.
    async done(event) {
        // If there was an error, we skip processing the results
        if (event.detail.success) {
            await this.processAtEndOfRun();
        }
        const windowId = event.detail.windowId;
        browser.tabs.onUpdated.removeListener(this.tabUpdateListener);
        this.tabUpdateListener = undefined;
        browser.windows.remove(windowId);
        this.doc.getElementById('freeze').disabled = false;
    }

    // This runs before the first visited page is loaded.
    async processAtBeginningOfRun() {
    }

    // Do per-tab stuff that should be subject to the timeout.
    async processWithinTimeout(tab, windowId) {
    }

    // Do per-tab stuff that should happen after the timeout is disabled. This
    // gets passed the result of processWithinTimeout().
    async processWithoutTimeout(result) {
    }

    // This runs after the last page is processed.
    async processAtEndOfRun() {
    }

    /**
     * Return a collection of user input from the form.
     *
     * @return {urls, timeout, otherOptions}, where `otherOptions` is an
     *     object encapsulating options specific to the PageVisitor subclass,
     *     opaque to the superclass. If the form data is invalid or contains
     *     no URLs, return undefined instead.
     */
    formOptions() {
        throw new Error('You must implement formOptions()')
    }

    // This is used to get the viewport size.
    getViewportHeightAndWidth() {
        throw new Error('You must implement getViewportHeightAndWidth()')
    }

    errorAndStop(error_message, tabId, windowId) {
        this.setCurrentStatus({
            message: error_message,
            index: tabId,
            isError: true,
            isFinal: true
        });
        this.doc.dispatchEvent(new CustomEvent(
          'fathom:done',
          {detail: {windowId: windowId, success: false}}
        ));

    }

    setCurrentStatus({message, index, isFinal=false, isError=false}) {
        // Add or update the status entry for the current url in the UI.
        // Messages marked as 'final' cannot be overwritten.

        let li = this.doc.getElementById('u' + index);
        if (!li) {
            li = this.doc.createElement('li');
            li.setAttribute('id', 'u' + index);
            this.doc.getElementById('status').appendChild(li);
        }

        // Don't overwrite 'final' messages (e.g. timeout, downloaded).
        // This ensures these messages aren't overwritten by an error generated by closing
        // the tab while things are running on it.
        if (li.classList.contains('final')) {
            return;
        }
        if (isFinal) {
            li.classList.add('final');
        }

        emptyElement(li);
        const urlObject = this.urls[this.tabIdToUrlsIndex.get(index)];
        const url = (urlObject === undefined) ? 'no URL' : urlObject.url;  // 'no URL' should never happen but comes in handy when avoiding the out-of-bound array access error when debugging this sprawling state machine.
        li.appendChild(this.doc.createTextNode(url + ': ' + message));
        if (isError) {
            li.classList.add('error');
        } else {
            li.classList.remove('error');
        }
    }
}
