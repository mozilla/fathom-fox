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
    switch (request.type) {
        case 'label':
            // TODO: Show a message or something if no element is inspected.
            elementAtPath(request.inspectedElement, document).setAttribute('data-fathom', request.label);
            break;
        case 'freeze':
            // Freeze a page at the bidding of the corpus collector or devtools
            // save button. Devtools panel calls this indirectly, by way of the
            // background script, so it can download the result when done.
            // Corpus collector calls directly.
            if (request.inspectedElement !== undefined) {
                hideHighlight();
            }
            const html = await freezeThisPage(request.options);
            if (request.inspectedElement !== undefined) {
                showHighlight(elementAtPath(request.inspectedElement, document));
            }
            return Promise.resolve(html);
        case 'showHighlight':
            if (request.inspectedElement !== undefined) {
                showHighlight(elementAtPath(request.inspectedElement, document));
            }
            break;
        case 'hideHighlight':
            hideHighlight();
            break;
    }
    return Promise.resolve({});
}
browser.runtime.onMessage.addListener(dispatch);

/**
 * Add a highlighter div over the given element.
 *
 * Firefox otherwise does nothing to make clear that the inspector's selection
 * is even preserved when a different devpanel is forward.
 */
function showHighlight(element) {
    hideHighlight();
    const highlighter = document.createElement('div');
    highlighter.id = 'fathomHighlighter';
    highlighter.style.backgroundColor = '#92DDF4';
    highlighter.style.opacity = '.70';
    highlighter.style.position = 'absolute';
    const rect = element.getBoundingClientRect();
    highlighter.style.width = rect.width + 'px';
    highlighter.style.height = rect.height + 'px';
    highlighter.style.top = rect.top + document.defaultView.pageYOffset + 'px';
    highlighter.style.left = rect.left + document.defaultView.pageXOffset + 'px';
    highlighter.style.padding = '0';
    highlighter.style.margin = '0';
    highlighter.style['border-radius'] = '0';
    document.getElementsByTagName('html')[0].appendChild(highlighter);
}

/**
 * Remove the highlighter div from the page.
 */
function hideHighlight() {
    const highlighter = document.getElementById('fathomHighlighter');
    if (highlighter !== null) {
        highlighter.parentNode.removeChild(highlighter);
    }
}
