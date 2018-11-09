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
    } else if (request.type === 'getMisrecognized') {
        sendResponse('#landingImage');
    }
});

// Update devtools panel when tab navigates to new page.
browser.tabs.onUpdated.addListener((tabId, changeInfo, tabInfo) => {
    if (tabInfo.status === 'complete') {
        browser.runtime.sendMessage({type: 'init'})
            .catch((error) => {
                console.error(error)
            });
    }
});
