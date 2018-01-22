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
    browser.tabs.executeScript(tab.id, {file: '/contentScripts/index.js'})
                .catch((e) => console.log(`Error while injecting freezing script into the tab: ${e}`));
}

/**
 * Handle clicks from the toolbar button.
 */
async function freezeAllPages() {
    await setViewportSize(1024, 768);
    await freezeNextPage();
}
browser.browserAction.onClicked.addListener(freezeAllPages);

/**
 * Set the current window's size such that the content area is the size you
 * pass in.
 *
 * @return a Promise that is resolved when the window size has been changed
 */
async function setViewportSize(width, height) {
    // Because window.outerHeight and friends are undefined from background
    // scripts, we have to collect the info by injecting a content script into
    // (arbitrarily) the active tab. However, we have to ensure that tab is not
    // showing about:blank, because webexts aren't allowed to inject scripts
    // there. So we open a page of our own first.
    const tab = await browser.tabs.create({url: '/pages/blank.html'});
    const windowSizes = (await browser.tabs.executeScript(tab.id, {file: '/contentScripts/measureWindowSize.js'}))[0];
    await browser.tabs.remove(tab.id);
    const window = await browser.windows.getCurrent();
    return browser.windows.update(
        window.id,
        {width: windowSizes.outerWidth - windowSizes.innerWidth + width,
         height: windowSizes.outerHeight - windowSizes.innerHeight + height});
}

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
