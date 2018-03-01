/**
 * Open a new Corpus window.
 */
async function openCorpusWindow() {
    browser.windows.create({url: '/pages/corpus.html'});
}
browser.browserAction.onClicked.addListener(openCorpusWindow);

// We've proven we can console.log from a promise then() callback in the bg script.

/**
 * Connect a dev panel, at its request, to the content script in its inspected
 * tab.
 */
function connectADevPanel(port) {
    // Open a port to our content script on the tab that's being inspected.
    port.onMessage.addListener(blabToTab);

    /** Send a single message to a tab. */
    async function blabToTab(request) {
        // console.log('Sending one-off message to tab', request.tabId);
        const stuff = await browser.tabs.sendMessage(request.tabId, request);
        // console.log('Received stuff from content script:', stuff);
        // Then send via the port to devpanel.
    }
}
browser.runtime.onConnect.addListener(connectADevPanel);

// Use tabs.connect() and runtime.onConnect to connect from here to a content script.