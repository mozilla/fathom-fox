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
 * Return a backward iterator over an Array.
 */
function *reversed(array) {
    for (let i = array.length - 1; i >= 0; i--) {
        yield array[i];
    }
}

/**
 * Deletes all children of the specified element.
 */
function emptyElement(element) {
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
}

// Requires simmer.js injected into current page.
// simmer.js is injected when the devtools panel is initialised when first opened.
async function inspectedElementSelector() {
    return resultOfEval(`Simmer.configure({depth: 25})($0)`);
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

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function initRulesetMenu(goButton) {
    // Draw Ruleset menu:
    let traineeKeys;
    traineeKeys = Array.from(trainees.keys());
    const menu = document.getElementById('ruleset');
    if (traineeKeys.length) {
        for (const traineeKey of traineeKeys) {
            const option = document.createElement('option');
            option.text = option.value = traineeKey;
            menu.add(option);
        }
    } else {
        goButton.disabled = true;
        menu.disabled = true;
        document.getElementById('please-install').classList.remove('hidden');
    }
}
