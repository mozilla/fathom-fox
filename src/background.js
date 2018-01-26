/**
 * Open a new Corpus window.
 */
async function openCorpusWindow() {
    browser.windows.create({url: '/pages/corpus.html'});
}
browser.browserAction.onClicked.addListener(openCorpusWindow);

// We've proven we can console.log from a promise then() callback in the bg script.
