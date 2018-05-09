document.getElementById('collectCorpus').addEventListener('click', () => browser.windows.create({url: '/pages/corpus.html'}));
document.getElementById('train').addEventListener(
    'click',
    function openTrainingTab() {
        browser.tabs.create({url: '/pages/train.html', active: true});
        window.close();
    });
