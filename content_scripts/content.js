import freezeDry from 'freeze-dry';

function tellBackgroundPage() {
    freezeDry(window.document, document.URL)
        .then((html) => browser.runtime.sendMessage({html}))
        .catch((error) => browser.runtime.sendMessage({error}));
}

tellBackgroundPage();