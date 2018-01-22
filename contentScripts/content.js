import freezeDry from 'freeze-dry';

/**
 * Serialize this page and its resources into HTML, then send it off to the
 * background script to be downloaded.
 */
function freezeThisPage() {
    freezeDry(window.document, document.URL)
        .then((html) => browser.runtime.sendMessage({html}))
        .catch((error) => browser.runtime.sendMessage({error}));
}

freezeThisPage();