async function freezeAllPages() {
    //freezeAllPages(document.getElementById('pages').value);
    const window = await browser.windows.create({url: '/pages/blank.html'});
    const blankTab = (await browser.tabs.query({windowId: window.id}))[0];
    await setViewportSize(blankTab, 1024, 768);
}
document.getElementById('freeze').onclick = freezeAllPages;

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
