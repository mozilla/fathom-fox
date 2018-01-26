import freezeDry from 'freeze-dry';

/**
 * Serialize this page and its resources into HTML, then send it off to the
 * corpus-window script to be downloaded.
 */
async function freezeThisPage(request) {
    return {response: await freezeDry(window.document, document.URL)};
}
browser.runtime.onMessage.addListener(freezeThisPage);
