async function go() {
    const tab = await browser.tabs.create({url: 'http://www.grinchcentral.com/', active: true});
    // Fire this and forget. We then pick up processing when the content script sends us a message, in receiveMessage().
    browser.tabs.executeScript(tab.id, {file: '/content_scripts/index.js'})
                .catch((err) => console.log(`Error while freeze-drying: ${err}`));
}
browser.browserAction.onClicked.addListener(go);

async function receiveMessage(message) {
    const blob = new Blob([message.html], {type: 'text/html'});
    const url = URL.createObjectURL(blob);
    try {
        await browser.downloads.download({url,
                                          filename: 'MyPage.html',
                                          saveAs: false});
    } catch (e) {
        console.log(e);
    } finally {
        // Give it 10 seconds; FF can be a bit slow.
        window.setTimeout(() => URL.revokeObjectURL(url), 1000 * 10);
    }
}
browser.runtime.onMessage.addListener(receiveMessage);

// We've proven we can console.log from a promise then() callback in the bg script.
