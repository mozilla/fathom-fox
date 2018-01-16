async function go() {
    const tab = await browser.tabs.create({url: 'http://www.grinchcentral.com/', active: true});
    // Fire this and forget. We then pick up processing when the content script sends us a message, in receiveMessage().
    browser.tabs.executeScript(tab.id, {file: '/content_scripts/index.js'})
                .catch((err) => console.log(`Error while freeze-drying: ${err}`));
}
browser.browserAction.onClicked.addListener(go);

function receiveMessage(message) {
    console.log('received: ' + message.html);
}
browser.runtime.onMessage.addListener(receiveMessage);

// We've proven we can console.log from a promise then() callback in the bg script.
