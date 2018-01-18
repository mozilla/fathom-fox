const urls = [
     'http://www.slashdot.org/',
     'http://www.amazon.com/',
     'http://www.startrek.com/',
     'http://www.questionablecontent.net/'
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
    browser.tabs.executeScript(tab.id, {file: '/content_scripts/index.js'})
                .catch((e) => console.log(`Error while freeze-drying: ${e}`));
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
    const window = await browser.windows.getCurrent();
    // Toolbars on the Mac on a fresh profile are 74px tall. We add that to get
    // the content area to the given height. It would be lovely to not hard-
    // code this.
    return browser.windows.update(window.id, {width, height: height + 74});
}

/**
 * Receive the serialized HTML from the content script, and save it to disk.
 * Then trigger the processing of the next page.
 */
async function saveHtml(message, sender, sendResponse) {
    const blob = new Blob([message.html], {type: 'text/html'});
    const url = URL.createObjectURL(blob);
    try {
        await browser.downloads.download({url,
                                          filename: 'MyPage.html',
                                          saveAs: false});
    } catch (e) {
        console.log(`Had an error while saving freeze-dried markup: ${e}`);
    }
    try {
        await browser.tabs.remove(sender.tab.id);
    } catch (e) {
        console.log(`Had an error while closing tab: ${e}`);
    }
    // Give it 10 seconds; FF can be a bit slow.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000 * 10);
    // Meanwhile, do another. Chaining the next onto the the end of the
    // previous serializes them, which I hypothesize is good because it means
    // the tab we're freezing is active. Sometimes various scripts seem to wait
    // until the tab is active to do their DOM manipulation, which we want to
    // capture.
    freezeNextPage();
}
browser.runtime.onMessage.addListener(saveHtml);

// We've proven we can console.log from a promise then() callback in the bg script.
