let backgroundPort = browser.runtime.connect();

function updateUi(evalResult) {
    if (!isError(evalResult)) {
        const firstLabeledElementId = evalResult[0];
        console.log(`result: ${firstLabeledElementId}`);
        document.getElementById('smoo').innerHTML = firstLabeledElementId;
    }
}

async function labelInspectedElement() {
    /**
     * The function embedded herein returns an "index path" to the inspected
     * element. A return value like [1, 4, 0] means the element could be found by
     * going into the 0th element of the document (usually an <html> tag), then the
     * 4th child of that tag, then finding the 1st child of that tag.
     */
    backgroundPort.postMessage({type: 'label',
                                tabId: browser.devtools.inspectedWindow.tabId,
                                inspectedElement: await inspectedElementPath(),
                                label: document.getElementById('labelField').value});
}
document.getElementById('labelButton').addEventListener('click', labelInspectedElement);

async function freezePage() {
    backgroundPort.postMessage({type: 'freeze',
                                tabId: browser.devtools.inspectedWindow.tabId,
                                inspectedElement: await inspectedElementPath(),
                                options: {shouldScroll: false, wait: 0}});
}
document.getElementById('saveButton').addEventListener('click', freezePage);

/**
 * Update the GUI to reflect the currently inspected page the first time the
 * panel loads.
 *
 * This runs once per Fathom dev-panel per inspected page. (When you navigate
 * to a new page, the Console pane comes forward, so this re-runs when the
 * Fathom pane is brought forward again. It does not run twice when you switch
 * away from and then back to the Fathom dev panel. Contents of the dev panel
 * are preserved across that interaction.)
 */
async function initPanel() {
    // When we load a new page with existing annotations:
    //browser.devtools.inspectedWindow.eval(`document.querySelectorAll("[data-fathom]")[0].id`).then(updateUi);
}
initPanel();
