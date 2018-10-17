let gUrls;  // Array of [filename, url] to freeze.
let gUrlIndex;  // Pointer to current url in gUrls.
let gFreezeOptions; // Freeze-dry options from UI.
let gTimeout; // Load+Freeze timeout from UI.

async function freezeAllPages(event) {
    event.preventDefault();

    // Check form validity.
    if (!(
        document.getElementById('wait').validity.valid &&
        document.getElementById('timeout').validity.valid
    )) {
        return;
    }

    initializeFromForm();
    emptyElement(document.getElementById('status'));

    // We need at least one url.
    if (!gUrls.length) {
        let li = document.createElement('li');
        li.classList.add('error');
        li.appendChild(document.createTextNode('no pages to download'));
        document.getElementById('status').appendChild(li);
        return;
    }

    document.getElementById('freeze').disabled = true;
    let windowId = 0;

    // Listen for tab events before we start creating tabs; this avoids race
    // conditions between creating tabs and waiting for loading to complete.
    async function onUpdated(tabId, changeInfo, tab) {
        if (
            tab.windowId !== windowId ||
            tab.url === 'about:blank' ||
            tab.status !== 'complete'
        ) {
            return;
        }

        if (tab.url.startsWith('moz-extension://')) {
            // The blank placeholder page has loaded.
            // Set its viewport size to a standard dimension.
            await setViewportSize(tab, gViewportWidth, gViewportHeight);
            // The start the freezing process.
            document.dispatchEvent(new CustomEvent(
                'fathom:next',
                {detail: windowId}
            ));

        } else {
            // Tab that needs to be frozen has loaded.

            // Set up the timeout; this covers both the page load and freeze time.
            let timer = setTimeout(freezeTimeout, gTimeout * 1000);
            async function freezeTimeout() {
                // Timeout.
                console.error(tab.url, 'timeout');
                clearTimeout(timer);
                setCurrentStatus({message: 'timeout', isFinal: true, isError: true});

                // Close the tab and process the next url.
                await browser.tabs.remove(tab.id);
                document.dispatchEvent(new CustomEvent(
                    'fathom:next',
                    {detail: windowId}
                ));
            }

            // Freeze this page.
            document.dispatchEvent(new CustomEvent(
                'fathom:freeze',
                {detail: {windowId: windowId, timer: timer}}
            ));
        }
    }
    browser.tabs.onUpdated.addListener(onUpdated);

    // Make freezing host window, and set its size. The blank page acts as a
    // placeholder so we don't have to repeatedly (and slowly) open and close
    // the window.
    windowId = (await browser.windows.create({url: '/pages/blank.html'})).id;
}
document.getElementById('freeze').onclick = freezeAllPages;

function fathomNext(event) {
    // Load next tab from gUrls, or close the window if we're done.

    const windowId = event.detail;

    gUrlIndex++;
    if (gUrlIndex >= gUrls.length) {
        browser.windows.remove(windowId);
        document.getElementById('freeze').disabled = false;
        return;
    }

    // Create a new tab with the current url, always as tab[0].
    // The tabs.onUpdated handler in freezeAllPages() will dispatch a fathom:freeze
    // event when the tab has completed loading.
    setCurrentStatus({message: 'loading'});
    browser.tabs.create({
        windowId: windowId,
        index: 0,
        url: gUrls[gUrlIndex].url,
    });
}
document.addEventListener('fathom:next', fathomNext, false);

async function fathomFreeze(event) {
    const windowId = event.detail.windowId;
    const timer = event.detail.timer;
    const tab = (await browser.tabs.query({windowId}))[0];

    setCurrentStatus({message: 'freezing'});
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
            {type: 'freeze', options: gFreezeOptions}
        );

        // Clear timeout here so we don't bail out while writing to disk.
        clearTimeout(timer);

        // Save html to disk.
        const filename = gUrls[gUrlIndex].filename;
        let download_filename = await download(html, {filename});

        setCurrentStatus({message: 'downloaded as ' + download_filename, isFinal: true});
    } catch (e) {
        console.error(tab.url, e.message);
        // When the tab is closed while things are processing we get errors that
        // are less than informative and require rewriting to be grokable.
        let error = e.message;
        if (error === "can't access dead object") {
            error = "unexpected removal of DOM element (can't access dead object). Try a longer freeze delay.";
        } else if (e.message === 'Message manager disconnected') {
            error = "tab unexpectedly closed (message manager disconnected)";
        }
        setCurrentStatus({
            message: 'freezing failed: ' + error, isError: true, isFinal: true
        });
    } finally {
        clearTimeout(timer);
        await browser.tabs.remove(tab.id);
    }

    // Done with this url, trigger loading of the next.
    document.dispatchEvent(new CustomEvent(
        'fathom:next',
        {detail: windowId}
    ));
}
document.addEventListener('fathom:freeze', fathomFreeze, false);

function setCurrentStatus({message, isFinal=false, isError=false}) {
    // Add or update the status entry for the current url in the UI.
    // Messages marked as 'final' cannot be overwritten.

    let li = document.getElementById('u' + gUrlIndex);
    if (!li) {
        li = document.createElement('li');
        li.setAttribute('id', 'u' + gUrlIndex);
        document.getElementById('status').appendChild(li);
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
    li.appendChild(document.createTextNode(gUrls[gUrlIndex].url + ': ' + message));
    if (isError) {
        li.classList.add('error');
    } else {
        li.classList.remove('error');
    }
}

function initializeFromForm() {
    // Initialize globals from the form.
    gFreezeOptions = {
        wait: parseFloat(document.getElementById('wait').value),
        shouldScroll: document.getElementById('shouldScroll').checked,
    };
    gUrlIndex = -1;
    gViewportWidth = parseInt(document.getElementById('viewportWidth').value);
    gViewportHeight = parseInt(document.getElementById('viewportHeight').value);

    // Note we extend the timeout by the freeze delay.
    gTimeout = parseFloat(document.getElementById('timeout').value) + gFreezeOptions.wait;

    // Load each url line-by-line from the textarea.
    // If a line contains a space, the first word will be used as the filename.
    gUrls = document
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
}

function setDownloadButtonEnabled() {
    initializeFromForm();
    document.getElementById('freeze').disabled = gUrls.length === 0;
}
document.getElementById('pages').addEventListener('keyup', setDownloadButtonEnabled);
setDownloadButtonEnabled();