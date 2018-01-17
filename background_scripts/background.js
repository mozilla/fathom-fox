/**
 * Handle clicks from the toolbar button.
 */
async function go() {
    await setViewportSize(1024, 768);
    const tab = await browser.tabs.create({url: 'http://www.slashdot.org/', active: true});
    // Fire this and forget. We then pick up processing when the content script
    // sends us a message, in saveHtml().
    browser.tabs.executeScript(tab.id, {file: '/content_scripts/index.js'})
                .catch((err) => console.log(`Error while freeze-drying: ${err}`));
}
browser.browserAction.onClicked.addListener(go);

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
 */
async function saveHtml(message) {
    const blob = new Blob([message.html], {type: 'text/html'});
    const url = URL.createObjectURL(blob);
    try {
        await browser.downloads.download({url,
                                          filename: 'MyPage.html',
                                          saveAs: false});
    } catch (e) {
        console.log(e);
    } finally {
        // Give it 10 seconds; FF can be a bit slow.
        window.setTimeout(() => URL.revokeObjectURL(url), 1000 * 10);
    }
}
browser.runtime.onMessage.addListener(saveHtml);

// We've proven we can console.log from a promise then() callback in the bg script.
