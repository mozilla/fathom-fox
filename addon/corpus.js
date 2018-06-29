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
    await tabCompletion(blankTab);  // Without this, "Error: No matching message handler"
    await setViewportSize(blankTab, 1024, 768);

    // Freeze the pages:
    const lines = document.getElementById('pages').value.split('\n').filter(line => line.length > 0);

    let namesAndUrls;
    if (lines[0].includes(' ') || lines[0].includes('\t')) {
        // We have explicit filename prepended to the lines, space-delimited.
        namesAndUrls = lines.map(function splitAndSuffix(l) {
            let [name, url] = l.split(/[ \t]/, 2);
            return [name + '.html', url];
        });
    } else {
        namesAndUrls = lines.map(l => [undefined, l]);
    }

    const freezeOptions = {wait: parseFloat(document.getElementById('wait').value.trim()),
                           shouldScroll: document.getElementById('shouldScroll').checked};
    for (let [filename, url] of namesAndUrls) {
        try {
            await freezePage(url, windowId, freezeOptions, filename);
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
 * Wait until the given tab reaches the "complete" status, then return the tab.
 *
 * This also deals with new tabs, which, before loading the requested page,
 * begin at about:blank, which itself reaches the "complete" status.
 */
async function tabCompletion(tab) {
    function isComplete(tab) {
        return tab.status === 'complete' && tab.url !== 'about:blank';
    }
    if (!isComplete(tab)) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(
                function giveUp() {
                    browser.tabs.onUpdated.removeListener(onUpdated);
                    if (isComplete(tab)) {
                        // Give it one last chance to dodge race condition
                        // in which it completes between the initial test
                        // and installation of the update listener.
                        resolve(tab);
                    } else {
                        reject(new Error('Tab never reached the "complete" state, just ' + tab.status + ' on ' + tab.url));
                    }
                },
                5000);
            function onUpdated(tabId, changeInfo, updatedTab) {
                // Must use updatedTab below; using just `tab` seems to remain
                // stuck to about:blank.
                if (tabId === updatedTab.id && isComplete(updatedTab)) {
                    clearTimeout(timer);
                    browser.tabs.onUpdated.removeListener(onUpdated);
                    resolve(updatedTab);
                }
            }
            browser.tabs.onUpdated.addListener(onUpdated);
        });
    }
}

/**
 * Serialize and download a page.
 *
 * @arg url {String} The URL of the page to download
 * @arg windowId {Number} The ID of the window to load the page (as a new tab)
 *     into for serialization
 */
async function freezePage(url, windowId, freezeOptions, filename) {
    const tab = await browser.tabs.create({url, windowId, active: true});
    await tabCompletion(tab);
    // Can't get a return value out of the content script because webpack wraps
    // our top-level stuff in a function. Instead, we use messaging.
    await browser.tabs.executeScript(tab.id, {file: '/contentScript.js'});
    const html = (await browser.tabs.sendMessage(tab.id, {type: 'freeze', options: freezeOptions}));
    await download(html, {filename});
    await browser.tabs.remove(tab.id);
}
