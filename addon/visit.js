// Framework for loading a series of pages one at a time and doing something to
// them

class PageVisitor {
    /**
     * Return a collection of user input from the form.
     *
     * @return {urls, timeout, viewportWidth, viewportHeight, otherOptions}, where
     *     `otherOptions` is an object encapsulating options specific to the
     *     PageVisitor subclass, opaque to the superclass. If the form data is
     *     invalid or contains no URLs, return undefined instead.
     */
    // formOptions() {
    // 
    // }

    constructor(document) {
        this.urls =[];  // Array of [filename, url] to freeze
        this.urlIndex = undefined;  // index of current URL in this.urls
        this.timeout = undefined;
        this.viewportWidth = undefined;
        this.viewportHeight = undefined;
        this.tabUpdateListener = undefined;
        this.otherOptions = undefined;
        this.doc = document;
    }

    addEventListeners() {
        this.doc.addEventListener('fathom:next', this.next.bind(this), false);
        this.doc.addEventListener('fathom:visitPage', this.visitPage.bind(this), false);
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

        const options = this.formOptions();
        if (options === undefined) {
            return;
        }
        this.urls = options.urls;
        this.timeout = options.timeout;
        this.viewportWidth = options.viewportWidth;
        this.viewportHeight = options.viewportHeight;
        this.otherOptions = options.otherOptions;

        emptyElement(document.getElementById('status'));

        this.doc.getElementById('freeze').disabled = true;
        let windowId = 'uninitialized window ID';
        this.urlIndex = -1;
        

        // Listen for tab events before we start creating tabs; this avoids race
        // conditions between creating tabs and waiting for loading to complete.
        async function onUpdated(tabId, changeInfo, tab) {
            if (tab.windowId !== windowId ||
                tab.url === 'about:blank' ||
                tab.url === 'about:newtab' ||
                tab.status !== 'complete'
            ) {
                return;
            }

            if (tab.url.startsWith('moz-extension://')) {  // /pages/blank.html
                if (changeInfo.status === 'complete') {  // Avoid the several other spurious update events that fire on blank.html.
                    // The blank placeholder page has loaded. Set its viewport size to
                    // a standard dimension. This is done as part of onUpdated()
                    // because calling executeScript() (within setViewportSize) before
                    // the tab is fully ready leads to an error. See
                    // https://bugzilla.mozilla.org/show_bug.cgi?id=1397667.
                    await setViewportSize(tab, visitor.viewportWidth, visitor.viewportHeight);
                    // The start the freezing process.
                    visitor.doc.dispatchEvent(new CustomEvent(
                        'fathom:next',
                        {detail: windowId}
                    ));
                }
            } else {
                // Tab that needs to be frozen has loaded.

                // Set up the timeout; this covers both the page load and freeze time.
                const timer = setTimeout(freezeTimeout, visitor.timeout * 1000);
                async function freezeTimeout() {
                    // Timeout.
                    console.error(tab.url, 'timeout');
                    clearTimeout(timer);
                    visitor.setCurrentStatus({message: 'timeout', isFinal: true, isError: true});

                    // Close the tab and process the next url.
                    await browser.tabs.remove(tab.id);
                    visitor.doc.dispatchEvent(new CustomEvent(
                        'fathom:next',
                        {detail: windowId}
                    ));
                }

                // Freeze this page.
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

    // Load next tab from this.urls, or close the window if we're done.
    next(event) {
        const windowId = event.detail;

        this.urlIndex++;
        if (this.urlIndex >= this.urls.length) {
            // Do final cleanup.
            browser.tabs.onUpdated.removeListener(this.tabUpdateListener);
            this.tabUpdateListener = undefined;
            browser.windows.remove(windowId);
            this.doc.getElementById('freeze').disabled = false;
            return;
        }

        // Create a new tab with the current url.
        // The tabs.onUpdated handler in visitAllPages() will dispatch a fathom:freeze
        // event when the tab has completed loading.
        this.setCurrentStatus({message: 'loading'});
        browser.tabs.create({
            windowId: windowId,
            url: this.urls[this.urlIndex].url,
        });
    }

    // A page to be frozen has finished loading. Serialize it.
    async visitPage(event) {
        const windowId = event.detail.windowId;
        const timer = event.detail.timer;
        const tab = (await browser.tabs.get(event.detail.tabId));

        this.setCurrentStatus({message: 'freezing'});
        try {
            // Can't get a return value out of the content script because webpack wraps
            // our top-level stuff in a function. Instead, we use messaging.
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

            // Clear timeout here so we don't bail out while writing to disk.
            clearTimeout(timer);

            // Save html to disk.
            const filename = this.urls[this.urlIndex].filename;
            const download_filename = await download(html, {filename});

            this.setCurrentStatus({message: 'downloaded as ' + download_filename, isFinal: true});
        } catch (e) {
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
            this.setCurrentStatus({
                message: 'freezing failed: ' + error, isError: true, isFinal: true
            });
        } finally {
            clearTimeout(timer);
            await browser.tabs.remove(tab.id);
        }

        // Done with this url, trigger loading of the next.
        this.doc.dispatchEvent(new CustomEvent(
            'fathom:next',
            {detail: windowId}
        ));
    }

    setCurrentStatus({message, isFinal=false, isError=false}) {
        // Add or update the status entry for the current url in the UI.
        // Messages marked as 'final' cannot be overwritten.

        let li = this.doc.getElementById('u' + this.urlIndex);
        if (!li) {
            li = this.doc.createElement('li');
            li.setAttribute('id', 'u' + this.urlIndex);
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
        const urlObject = this.urls[this.urlIndex];
        const url = (urlObject === undefined) ? 'no URL' : urlObject.url;  // 'no URL' should never happen but comes in handy when avoiding the out-of-bound array access error when debugging this sprawling state machine.
        li.appendChild(this.doc.createTextNode(url + ': ' + message));
        if (isError) {
            li.classList.add('error');
        } else {
            li.classList.remove('error');
        }
    }
}
