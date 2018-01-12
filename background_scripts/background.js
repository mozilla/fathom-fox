async function go() {
    browser.tabs.executeScript({
        file: '/content_scripts/index.js'
    });
}

browser.browserAction.onClicked.addListener(go);
