import freezeDry from 'freeze-dry';

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Serialize this page and its resources into HTML, then send it off to the
 * corpus-window script to be downloaded.
 */
async function freezeThisPage(request) {
    await sleep(request.wait * 1000);
    return {response: await freezeDry(window.document, document.URL)};
}
browser.runtime.onMessage.addListener(freezeThisPage);
