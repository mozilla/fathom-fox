/**
 * Return the DOM element indicated by an array of offsets as described in
 * elementPath().
 */
function elementAtPath(path, document) {
    let node = document;
    for (const index of reversed(path)) {
        node = node.children[index];
    }
    return node;
}

/**
 * Return the result of a browser.devtools.inspectedWindow.eval call. Throw the
 * error object on failure.
 */
async function resultOfEval(codeString) {
    let [result, error] = await browser.devtools.inspectedWindow.eval(codeString);
    if (error !== undefined) {
        throw error;
    }
    return result;
}

/**
 * Return an backward iterator over an Array.
 */
function *reversed(array) {
    for (let i = array.length - 1; i >= 0; i--) {
        yield array[i];
    }
}

/**
 * Return an "index path" to the element inspected by the dev tools; undefined
 * if none is inspected.
 *
 * Callable only from devtools panels or openers.
 */
async function inspectedElementPath() {
    const inspectedElementPathSource = `
        (function pathOfElement(element) {
            function indexOf(arrayLike, item) {
                for (let i = 0; i < arrayLike.length; i++) {
                    if (arrayLike[i] === item) {
                        return i;
                    }
                }
                throw new Error('Item was not found in collection.');
            }

            if (element === undefined) {
                return undefined;
            }
            const path = [];
            let node = element;
            while (node.parentNode !== null) {
                path.push(indexOf(node.parentNode.children, node));
                node = node.parentNode;
            }
            return path;
        })($0)
        `;
    return resultOfEval(inspectedElementPathSource);
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

/**
 * Given a URL as a string, return the last segment, minus any ".html"
 * extension.
 */
function urlFilename(url) {
    return url.substring(url.lastIndexOf('/') + 1, url.endsWith('.html') ? url.length - 5 : url.length)
}
