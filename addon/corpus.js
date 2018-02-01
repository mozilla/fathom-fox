async function freezeAllPages() {
    // Grey out Freeze button:
    document.getElementById('freeze').disabled = true;

    // Clear error field:
    const errorField = document.getElementById('errors');
    while (errorField.firstChild) {
        errorField.removeChild(errorField.firstChild);
    }

    // Make freezing window, and set its size. The blank page acts as a
    // placeholder so we don't have to repeatedly (and slowly) open and close
    // the window.
    const windowId = (await browser.windows.create({url: '/pages/blank.html'})).id;
    const blankTab = (await browser.tabs.query({windowId}))[0];
    await setViewportSize(blankTab, 1024, 768);

    // Freeze the pages:
    const urls = document.getElementById('pages').value.split('\n').filter(url => url.length > 0);
    const freezeOptions = {wait: parseFloat(document.getElementById('wait').value.trim()),
                           shouldScroll: document.getElementById('shouldScroll').checked};
    for (const url of urls) {
        try {
            await freezePage(url, windowId, freezeOptions);
        } catch (e) {
            // What can go wrong? Redirects mess up our messaging pipeline.
            // Modal alerts hang us until the user dismisses them.
            errorField.appendChild(document.createTextNode(`\nError while freezing ${url}: ${e}`));
        }
    }

    // Clean up:
    browser.windows.remove(windowId).catch(() => null);  // Swallow error if window is absent.
    document.getElementById('freeze').disabled = false;
}
document.getElementById('freeze').onclick = freezeAllPages;

/**
 * Serialize and download a page.
 *
 * @arg url {String} The URL of the page to download
 * @arg windowId {Number} The ID of the window to load the page (as a new tab)
 *     into for serialization
 */
async function freezePage(url, windowId, freezeOptions) {
    const tab = await browser.tabs.create({url, windowId, active: true});
    // Can't get a return value out of this because webpack wraps our top-level
    // stuff in a function. Instead, we use messaging.
    // browser.downloads is good here.
    await browser.tabs.executeScript(tab.id, {file: '/freezeDryThisPage.js'});
    const html = (await browser.tabs.sendMessage(tab.id, freezeOptions)).response;
    await download(html);
    await browser.tabs.remove(tab.id);
}

/**
 * Save the given HTML to the user's downloads folder.
 */
async function download(html) {
    const blob = new Blob([html], {type: 'text/html'});
    const url = URL.createObjectURL(blob);
    await browser.downloads.download({url,
                                      filename: 'MyPage.html',
                                      saveAs: false});
    // Give it 10 seconds; FF can be a bit slow.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000 * 10);
}

/**
 * Set the current window's size such that the content area is the size you
 * pass in.
 *
 * @arg tab {tabs.Tab} A tab in the window we're adjusting that we can inject
 *     the window-measuring script into
 *
 * @return a Promise that is resolved when the window size has been changed
 */
async function setViewportSize(tab, width, height) {
    // Because window.outerHeight and friends are undefined from background
    // scripts, we have to collect the info by injecting a content script into
    // (arbitrarily) the active tab. However, we have to ensure that tab is not
    // showing about:blank, because webexts aren't allowed to inject scripts
    // there. So we open a page of our own first.
    const windowSizes = (await browser.tabs.executeScript(tab.id, {file: '/measureWindowSize.js'}))[0];
    return browser.windows.update(
        tab.windowId,
        {width: windowSizes.outerWidth - windowSizes.innerWidth + width,
         height: windowSizes.outerHeight - windowSizes.innerHeight + height});
}
