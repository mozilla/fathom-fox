let backgroundPort = browser.runtime.connect();

async function createPanel() {
    const extensionPanel = await browser.devtools.panels.create(
        'Fathom',
        '/icons/icon.svg',
        '/pages/devtoolsPanel.html');
    extensionPanel.onShown.addListener(panelShown);
    extensionPanel.onHidden.addListener(panelHidden);
}

async function panelShown(extensionPanel) {
    // TODO: Pull data attrs into UI.

    backgroundPort.postMessage({type: 'showHighlight',
                                tabId: browser.devtools.inspectedWindow.tabId,
                                inspectedElement: await inspectedElementPath()});
}

function panelHidden(extensionPanel) {
    backgroundPort.postMessage({type: 'hideHighlight',
                                tabId: browser.devtools.inspectedWindow.tabId});
}

createPanel();
