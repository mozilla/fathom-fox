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

    initialiseFromForm();
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
    browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (
            tab.windowId !== windowId ||
            tab.url === 'about:blank' ||
            tab.status !== 'complete'
        ) {
            return;
        }

        if (tab.url.startsWith('moz-extension://')) {
            // The blank placeholder page has loaded, start the freezing process.
            document.dispatchEvent(new CustomEvent(
                'fathom:next',
                { detail: windowId }
            ));

        } else {
            // Tab that needs to be frozen has loaded.

            // Setup the timeout; this covers both the page load and freeze time.
            let timer = setTimeout(() => {
                // Timeout.
                console.error(tab.url, 'timeout');
                clearTimeout(timer);
                setCurrentStatus('timeout', true);

                // Close the tab and process the next url.
                browser.tabs.remove(tab.id)
                    .then(() => {
                        document.dispatchEvent(new CustomEvent(
                            'fathom:next',
                            { detail: windowId }
                        ));
                    })
            }, gTimeout * 1000);

            // Freeze this page.
            document.dispatchEvent(new CustomEvent(
                'fathom:freeze',
                { detail: { windowId: windowId, timer: timer }}
            ));
        }
    });

    // Make freezing host window, and set its size. The blank page acts as a
    // placeholder so we don't have to repeatedly (and slowly) open and close
    // the window.
    windowId = (await browser.windows.create({
        url: '/pages/blank.html',
        width: 1024,
        height: 768,
    })).id;
}
document.getElementById('freeze').onclick = freezeAllPages;

function fathomNext(event) {
    const windowId = event.detail;

    // Load next tab, or close the window if we're done.
    gUrlIndex++;
    if (gUrlIndex >= gUrls.length) {
        browser.windows.remove(windowId);
        document.getElementById('freeze').disabled = false;
        return;
    }

    // Create a new tab with the current url, always as tab[0].
    // The tabs.onUpdated handler in freezeAllPages() will dispatch a fathom:freeze
    // event when the tab has completed loading.
    setCurrentStatus('loading');
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
    const tab = (await browser.tabs.query({ windowId }))[0];

    setCurrentStatus('freezing');
    try {
        // Can't get a return value out of the content script because webpack wraps
        // our top-level stuff in a function. Instead, we use messaging.
        await browser.tabs.executeScript(
            tab.id,
            { file: '/contentScript.js' }
        );

        // Call freeze-dry to fetch html.
        const html = await browser.tabs.sendMessage(
            tab.id,
            { type: 'freeze', options: gFreezeOptions }
        );

        // Clear timeout here so we don't bail out while writing to disk.
        clearTimeout(timer);

        // Save html to disk.
        const filename = gUrls[gUrlIndex].filename;
        await download(html, { filename });

        setCurrentStatus('downloaded');
    } catch(e) {
        console.error(tab.url, e.message);
        // When the tab is closed while things are processing we get errors that
        // are less than informative.
        // "Can't access dead object" means the DOM changed while freeze-dry was
        // running and an object that it's trying to resolve was removed.
        // "Message manager disconnected" generally means the tab was closed.
        if (
            e.message === "can't access dead object" ||
            e.message === 'Message manager disconnected'
        ) {
            setCurrentStatus('error (freezing failed)', true);
        } else {
            setCurrentStatus('error (' + e.message + ')', true);
        }
    } finally {
        clearTimeout(timer);
        await browser.tabs.remove(tab.id);
    }

    // Done with this url, trigger loading of the next.
    document.dispatchEvent(new CustomEvent(
        'fathom:next',
        { detail: windowId }
    ));
}
document.addEventListener('fathom:freeze', fathomFreeze, false);

function setCurrentStatus(message, isError=false) {
    // Add or update the status entry for the current url in the UI.

    let li = document.getElementById('u' + gUrlIndex);
    if (!li) {
        li = document.createElement('li');
        li.setAttribute('id', 'u' + gUrlIndex);
        document.getElementById('status').appendChild(li);
    }

    // Only show the first error triggered for the url.  This ensures a "timeout"
    // error isn't overwritten by an error generated by closing the tab while things
    // are running on it.
    if (isError && li.classList.contains('error')) {
        return;
    }

    emptyElement(li);
    li.appendChild(document.createTextNode(gUrls[gUrlIndex].url + ': ' + message));
    if (isError) {
        li.classList.add('error');
    } else {
        li.classList.remove('error');
    }
}

function initialiseFromForm() {
    // Initialise globals from the form.
    gFreezeOptions = {
        wait: parseFloat(document.getElementById('wait').value),
        shouldScroll: document.getElementById('shouldScroll').checked,
    };
    gUrlIndex = -1;

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
            let obj = {};
            if (parts.length === 1) {
                obj.filename = undefined;
                obj.url = parts[0];
            } else {
                obj.filename = parts[0];
                obj.url = parts[1];
            }
            // Prepend protocol if missing.
            if (!obj.url.match(/^https?:\/\//)) {
                obj.url = 'http://' + obj.url;
            }
            return obj;
        });
}

