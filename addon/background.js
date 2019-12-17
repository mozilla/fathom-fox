/**
  * Handle messages that used to come to the fathom-trainees webext from
  * FathomFox. It's possible that some of these are no longer needed or that
  * the indirection is no longer needed. However, in some cases, it's necessary
  * to dispatch to the background script so we have permission to call the APIs
  * we need.
  */
function handleBackgroundScriptMessage(request, sender, sendResponse) {
    if (request.type === 'rulesetSucceededOnTabs') {
        // Run a given ruleset on a given set of tabs, and return an array
        // of bools saying whether they got the right answer on each.
        Promise.all(request.tabIds.map(
                        tabId => browser.tabs.sendMessage(
                            tabId,
                            {type: 'rulesetSucceeded',
                             traineeId: request.traineeId,
                             coeffs: request.coeffs})))
               .then(sendResponse);
        return true;  // so sendResponse hangs around after we return
    } else if (request.type === 'vectorizeTab') {
        const vector = browser.tabs.sendMessage(request.tabId, request);
        sendResponse(vector);
    } else if (request.type === 'labelBadElement') {
        // Just forward these along to the correct tab:
        browser.tabs.sendMessage(request.tabId, request)
    } else if (request.type === 'traineeKeys') {
        // Return an array of IDs of rulesets we can train.
        sendResponse(Array.from(trainees.keys()));
    } else if (request.type === 'trainee') {
        // Return all the properties of a trainee that can actually be
        // serialized and passed over a message.
        const trainee = Object.assign({}, trainees.get(request.traineeId));  // shallow copy
        delete trainee.rulesetMaker;  // unserializeable
        sendResponse(trainee);
    }
}
browser.runtime.onMessage.addListener(handleBackgroundScriptMessage);

/**
 * Connect a dev panel, at its request, to the content script in its inspected
 * tab.
 */
function connectADevPanel(port) {
    // Open a port to our content script on the tab that's being inspected.
    port.onMessage.addListener(handleMessage);

    /**
     * Handle any of the various messages that can come flying at the
     * background script from various sources.
     */
    async function handleMessage(request) {
        if (request.type === 'freeze') {
            // Send 'freeze' request to content-script to fetch frozen html
            browser.tabs.sendMessage(request.tabId, request)
                .then((html) => {
                    // Show save file dialog.  When the dialog is closed send a 'refresh'
                    // message to the devpanel so it can hide the spinner.
                    download(html, {saveAs: true})
                        .then(() => {
                            browser.runtime.sendMessage({type: 'refresh'});
                        })
                        .catch(() => {
                            browser.runtime.sendMessage({type: 'refresh'});
                        });
                });
        } else {
            // Most requests are passed unmodified to the content script.
            await browser.tabs.sendMessage(request.tabId, request);
        }
    }
}
browser.runtime.onConnect.addListener(connectADevPanel);

// Bridge between content and the devtools panel.
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'refresh') {
        browser.runtime.sendMessage({type: 'refresh'}).catch(() => {});
    }
});

// Update devtools panel when tab navigates to new page.
browser.tabs.onUpdated.addListener((tabId, changeInfo, tabInfo) => {
    if (changeInfo.status === 'complete') {
        browser.runtime.sendMessage({type: 'init'})
            .catch((error) => {
                console.error(error)
            });
    }
});

async function freeze_tab(tab) {
    const html = await browser.tabs.sendMessage(
        tab.id,
        {
            type: 'freeze',
            options: {
                wait: 0,
                shouldScroll: false
            }
        }
    );
    await download(html, {saveAs: true});
}

browser.commands.onCommand.addListener((command) => {
    if (command === 'freeze-page') {
        browser.tabs.query({currentWindow: true, active: true})
            .then((tabs) => {
                return tabs[0];
            })
            .then((tab) => {
                return freeze_tab(tab);
            })
            .catch((error) => {
                console.log(error);
            });
    }
});
