// Subsequent clicks to the toolbar button do nothing, since this array is
// emptied by the first:
const urls = [
     'http://www.grinchcentral.com/'
];

/**
 * Pop the next page off `urls`, and freeze-dry it.
 */
async function freezeNextPage() {
    const url = urls.pop()
    if (url === undefined) {
        return;
    }
    const tab = await browser.tabs.create({url, active: true});
    // Fire this and forget, because webpack wraps our top-level stuff in a
    // function, and so we can't return anything. Instead, we pick up
    // processing when the content script sends us a message, in
    // saveHtml().
    browser.tabs.executeScript(tab.id, {file: '/freezeDryThisPage.js'})
                .catch((e) => console.log(`Error while injecting freezing script into the tab: ${e}`));
}

/**
 * Handle clicks from the toolbar button.
 */
async function freezeAllPages() {
    await setViewportSize(1024, 768);
    await freezeNextPage();
}

/**
 * Open a new Corpus window.
 */
async function openCorpusWindow() {
    browser.windows.create({url: '/pages/corpus.html'});
}
browser.browserAction.onClicked.addListener(openCorpusWindow);

/**
 * Receive the serialized HTML from the content script, and save it to disk.
 * Then trigger the processing of the next page.
 *
 * There are 2 kinds of message I receive::
 *
 *     {error: 'error message'}
 *     {html: 'the frozen HTML of a page'}
 */
async function saveHtml(message, sender, sendResponse) {
    if (message.hasOwnProperty('error')) {
        // Receive an error report:
        console.log(`Error while freezing a page: ${message.error}`);
    } else {
        // Receive a serialized HTML page:
        const blob = new Blob([message.html], {type: 'text/html'});
        const url = URL.createObjectURL(blob);
        try {
            await browser.downloads.download({url,
                                              filename: 'MyPage.html',
                                              saveAs: false});
        } catch (e) {
            console.log(`Error while saving frozen markup: ${e}`);
        }
        try {
            await browser.tabs.remove(sender.tab.id);
        } catch (e) {
            console.log(`Error while closing tab: ${e}`);
        }
        // Give it 10 seconds; FF can be a bit slow.
        window.setTimeout(() => URL.revokeObjectURL(url), 1000 * 10);
    }
    // Whether or not this one had an error, do another. Chaining the next onto
    // the the end of the previous serializes them, which I hypothesize is good
    // because it means the tab we're freezing is active. Sometimes various
    // scripts seem to wait until the tab is active to do their DOM
    // manipulation, which we want to capture.
    freezeNextPage();
}
browser.runtime.onMessage.addListener(saveHtml);

// We've proven we can console.log from a promise then() callback in the bg script.
