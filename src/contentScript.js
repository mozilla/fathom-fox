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
function dispatch(request) {
    switch (request.type) {
        case 'init':
            injectSimmer();
            break;

        case 'label':
            setLabel(request);
            break;

        case 'freeze':
            return freezePage(request);

        case 'showHighlight':
            showHighlight(request.selector);
            break;

        case 'hideHighlight':
            hideHighlight();
            break;
    }
}
browser.runtime.onMessage.addListener(dispatch);

// Inject the Simmer library into the current page, so we can use it to
// build the CSS path to elements.  This injection only happens when the
// dev panel is first opened.
function injectSimmer() {
    if (document.getElementById('fathom-simmer')) {
        return;
    }
    const script = document.createElement('script');
    script.setAttribute('id', 'fathom-simmer');
    script.setAttribute('src', browser.extension.getURL('simmer.js'));
    script.setAttribute('onload', `
        window.Simmer = window.Simmer.configure({
            depth: 25
        });
    `);
    document.head.appendChild(script);
}

function removeSimmer() {
    const simmerElement = document.getElementById('fathom-simmer');
    if (simmerElement) {
        simmerElement.parentNode.removeChild(simmerElement);
    }
}

// Set or clear the label on the element specifed by request.selector.
function setLabel(request) {
    if (!request.selector) {
        return;
    }

    // Find target element.
    const inspectedElement = document.querySelector(request.selector);
    if (!inspectedElement) {
        console.error('failed to find element', request.selector);
        return;
    }

    // Update or delete data-fathom attribute.
    if (request.label !== undefined && request.label !== '') {
        inspectedElement.dataset.fathom = request.label;
    } else {
        delete inspectedElement.dataset.fathom;
    }

    // Refresh the devtools panel UI.
    browser.runtime.sendMessage({type: 'refresh'});
}

// Freeze a page at the bidding of the corpus collector or devtools
// save button. Devtools panel calls this indirectly, by way of the
// background script, so it can download the result when done.
// Corpus collector calls directly.
function freezePage(request) {
    // Remove the simmer <script> element.  This doesn't need to be put back
    // as the `Simmer` object will exist and won't need to be recreated.
    removeSimmer();

    // Remove the highlight/overlay.  This will need to be restored.
    hideHighlight();

    return freezeThisPage(request.options)
        .then((html) => {
            if (request.selector) {
                showHighlight(request.selector);
            }
            return html;
        });
}

/**
 * Add a highlighter div over the given element.
 *
 * Firefox otherwise does nothing to make clear that the inspector's selection
 * is even preserved when a different devpanel is forward.
 */
function showHighlight(selector) {
    hideHighlight();

    if (!selector) {
        return;
    }

    const element = document.querySelector(selector);
    if (!element) {
        console.error('failed to find element for', selector);
        return;
    }

    const highlighter = document.createElement('div');
    highlighter.id = 'fathomHighlighter';
    highlighter.style.backgroundColor = '#92DDF4';
    highlighter.style.opacity = '.70';
    highlighter.style.position = 'absolute';
    highlighter.style.zIndex = '99999';
    const rect = element.getBoundingClientRect();
    highlighter.style.width = rect.width + 'px';
    highlighter.style.height = rect.height + 'px';
    highlighter.style.top = rect.top + document.defaultView.pageYOffset + 'px';
    highlighter.style.left = rect.left + document.defaultView.pageXOffset + 'px';
    highlighter.style.padding = '0';
    highlighter.style.margin = '0';
    highlighter.style['border-radius'] = '0';
    document.documentElement.appendChild(highlighter);
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
