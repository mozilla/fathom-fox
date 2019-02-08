let gUrls;  // Array of [filename, url] to freeze.
let gUrlIndex;  // Pointer to current url in gUrls.
let gFreezeOptions; // Freeze-dry options from UI.
let gTimeout; // Load+Freeze timeout from UI.
let gViewportHeight, gViewportWidth;

async function vectorizeAllPages(event) {
    event.preventDefault();

    initializeFromForm();
    emptyElement(document.getElementById('status'));

    // We need at least one url.
    if (!gUrls.length) {
        let li = document.createElement('li');
        li.classList.add('error');
        li.appendChild(document.createTextNode('no pages to vectorize'));
        document.getElementById('status').appendChild(li);
        return;
    }

    document.getElementById('vectorize').disabled = true;
    let windowId = 0;

    // Listen for tab events before we start creating tabs; this avoids race
    // conditions between creating tabs and waiting for loading to complete.
    async function onUpdated(tabId, changeInfo, tab) {
        if (
            tab.windowId !== windowId ||
            tab.url === 'about:blank' ||
            tab.url === 'about:newtab' ||
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
            // Tab that needs to be frozen has loaded. Vectorize it.
            document.dispatchEvent(new CustomEvent(
                'fathom:vectorize',
                {detail: {windowId: windowId}}
            ));
        }
    }
    browser.tabs.onUpdated.addListener(onUpdated);

    // Make freezing host window, and set its size. The blank page acts as a
    // placeholder so we don't have to repeatedly (and slowly) open and close
    // the window.
    windowId = (await browser.windows.create({url: '/pages/blank.html'})).id;
}
document.getElementById('vectorize').onclick = vectorizeAllPages;

function fathomNext(event) {
    // Load next tab from gUrls, or close the window if we're done.
    const windowId = event.detail;

    gUrlIndex++;
    if (gUrlIndex >= gUrls.length) {
        browser.windows.remove(windowId);
        document.getElementById('vectorize').disabled = false;
        return;
    }

    // Create a new tab with the current url, always as tab[0].
    // The tabs.onUpdated handler in vectorizeAllPages() will dispatch a
    // fathom:vectorize event when the tab has completed loading.
    setCurrentStatus({message: 'loading'});
    browser.tabs.create({
        windowId: windowId,
        index: 0,
        url: gUrls[gUrlIndex],
    });
}
document.addEventListener('fathom:next', fathomNext, false);

async function vectorize(event) {
    const windowId = event.detail.windowId;
    const timer = event.detail.timer;
    const tab = (await browser.tabs.query({windowId}))[0];

    setCurrentStatus({message: 'vectorizing'});
    try {
        // Have fathom-trainees vectorize the page:
        const vector = await browser.runtime.sendMessage(
            'fathomtrainees@mozilla.com',
            {type: 'vectorizeTab',
             tabId: tab.id,
             traineeId: 'price'});  // TODO: don't hard code

        // Save vector to disk. TODO: collect vectors and save all in one file.
        let download_filename = await download(JSON.stringify(vector),
                                               {filename: 'vectors.json'});

        setCurrentStatus({message: 'vectorized as ' + download_filename, isFinal: true});
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
            message: 'vectorizing failed: ' + error, isError: true, isFinal: true
        });
    } finally {
        await browser.tabs.remove(tab.id);
    }

    // Done with this url, trigger loading of the next.
    document.dispatchEvent(new CustomEvent(
        'fathom:next',
        {detail: windowId}
    ));
}
document.addEventListener('fathom:vectorize', vectorize, false);

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
    li.appendChild(document.createTextNode(gUrls[gUrlIndex] + ': ' + message));
    if (isError) {
        li.classList.add('error');
    } else {
        li.classList.remove('error');
    }
}

function initializeFromForm() {
    // Initialize globals from the form.
    gUrlIndex = -1;
    gViewportWidth = parseInt(document.getElementById('viewportWidth').value);
    gViewportHeight = parseInt(document.getElementById('viewportHeight').value);

    // Load each url line-by-line from the textarea.
    gUrls = document
        .getElementById('pages')
        .value
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
}

function setButtonEnabled() {
    initializeFromForm();
    document.getElementById('vectorize').disabled = gUrls.length === 0;
}
document.getElementById('pages').addEventListener('keyup', setButtonEnabled);
setButtonEnabled();
