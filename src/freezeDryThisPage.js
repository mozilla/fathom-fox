import freezeDry from 'freeze-dry';

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Serialize this page and its resources into HTML, then send it off to the
 * corpus-window script to be downloaded.
 */
async function freezeThisPage(request) {
    // Scroll first, then wait. That way, the waiting can also profit
    // dynamically loaded elements toward the bottom of the page.
    if (request.shouldScroll) {
        scrollTo(0, document.body.scrollHeight);
        // TODO: Keep scrolling to the bottom as elements are added that
        // lengthen the page.
    }
    await sleep(request.wait * 1000);
    return {response: await freezeDry(window.document, document.URL)};
}
browser.runtime.onMessage.addListener(freezeThisPage);
