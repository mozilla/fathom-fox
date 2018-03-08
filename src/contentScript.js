let backgroundPort = browser.runtime.connect();

/**
 * This holds references to DOM elements on behalf of our devtools panel which,
 * since it runs in a different process, can't get ahold of them. (You see this
 * in the documented limitations of inspectedWindow.eval(), which can pass only
 * simple JSON objects around.) Essentially, this is the controller, and the
 * dev panel is the view.
 *
 * It also serializes web pages.
 */
import freezeDry from 'freeze-dry';

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Serialize this page and its resources into HTML, and return the HTML.
 */
async function freezeThisPage(options) {
    // Scroll first, then wait. That way, the waiting can also profit
    // dynamically loaded elements toward the bottom of the page.
    if (options.shouldScroll) {
        scrollTo(0, document.body.scrollHeight);
        // TODO: Keep scrolling to the bottom as elements are added that
        // lengthen the page.
    }
    await sleep(options.wait * 1000);
    return freezeDry(window.document, document.URL);
}

/**
 * Top-level dispatcher for commands sent from the devpanel or corpus collector
 * to this content script
 */
async function dispatch(request) {
    if (request.type === 'label') {
        elementAtPath(request.elementPath, document).setAttribute('data-fathom', request.label);
        return Promise.resolve({});
    } else if (request.type === 'freeze') {
        // Freeze a page at the bidding of the corpus collector or devtools
        // save button. Devtools panel calls this indirectly, by way of the
        // background script, so it can download the result when done. Corpus
        // collector calls directly.
        const html = await freezeThisPage(request.options);
        return Promise.resolve(html);
    }
}
browser.runtime.onMessage.addListener(dispatch);
