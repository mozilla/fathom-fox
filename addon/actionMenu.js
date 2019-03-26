function openTab(url) {
    browser.tabs.create({url, active: true});
    window.close();
}

document.getElementById('collectCorpus').addEventListener('click', () => openTab('/pages/corpus.html'));
document.getElementById('train').addEventListener('click', () => openTab('/pages/train.html'));
document.getElementById('vectorize').addEventListener('click', () => openTab('/pages/vector.html'));
