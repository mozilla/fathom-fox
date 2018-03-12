let backgroundPort = browser.runtime.connect();

async function createPanel() {
    const extensionPanel = await browser.devtools.panels.create(
        'Fathom',
        '/icons/leftpad-32.png',
        '/pages/devtoolsPanel.html');
    extensionPanel.onShown.addListener(panelShowed);
    extensionPanel.onHidden.addListener(panelHid);
}

async function panelShowed(extensionPanel) {
    // TODO: Pull data attrs into UI.

    backgroundPort.postMessage({type: 'showHighlight',
                                tabId: browser.devtools.inspectedWindow.tabId,
                                inspectedElement: await inspectedElementPath()});
}

function panelHid(extensionPanel) {
    backgroundPort.postMessage({type: 'hideHighlight',
                                tabId: browser.devtools.inspectedWindow.tabId});
}

createPanel();
