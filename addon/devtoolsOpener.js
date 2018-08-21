let backgroundPort = browser.runtime.connect();

function createPanel() {
    browser.devtools.panels.create(
        'Fathom',
        '/icons/icon.svg',
        '/pages/devtoolsPanel.html'
    ).then((extensionPanel) => {
        extensionPanel.onShown.addListener(panelShown);
        extensionPanel.onHidden.addListener(panelHidden);
    });
}

function panelShown() {
    inspectedElementSelector()
        .then((selector) => {
            backgroundPort.postMessage({
                type: 'showHighlight',
                tabId: browser.devtools.inspectedWindow.tabId,
                selector: selector,
            });
            browser.runtime.sendMessage({type: 'refresh'});
        })
        .catch((error) => {
            console.error(error);
        });
}

function panelHidden() {
    backgroundPort.postMessage({
        type: 'hideHighlight',
        tabId: browser.devtools.inspectedWindow.tabId,
    });
}

createPanel();
