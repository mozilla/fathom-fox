/**
 * Return the result of a browser.devtools.inspectedWindow.eval call. Throw the
 * error object on failure.
 */
async function resultOfEval(codeString) {
    let [result, error] = await browser.devtools.inspectedWindow.eval(codeString);
    if (error !== undefined) {
        throw error;
    }
    return result;
}

function updateUi(evalResult) {
    if (!isError(evalResult)) {
        const firstLabeledElementId = evalResult[0];
        console.log(`result: ${firstLabeledElementId}`);
        document.getElementById('smoo').innerHTML = firstLabeledElementId;
    }
}

const inspectedId = `
(function inspectedElementPath() {
    return $0.getAttribute('id');
})()
`;
async function labelInspectedElement() {
    console.log('Posting message from devpanel to background script.');
    const id = await resultOfEval(inspectedId);
    backgroundPort.postMessage({type: 'label', tabId: browser.devtools.inspectedWindow.tabId, element: id});
}
document.getElementById('label').addEventListener('click', labelInspectedElement);

/**
 * Update the GUI to reflect the currently inspected page the first time the
 * panel loads.
 *
 * This runs once per Fathom dev-panel per inspected page. (When you navigate
 * to a new page, the Console pane comes forward, so this re-runs when the
 * Fathom pane is brought forward again. It does not run twice when you switch
 * away from and then back to the Fathom dev panel.)
 */
let backgroundPort;
async function initPanel() {
    backgroundPort = browser.runtime.connect();
    // devpanel can mutate the inspected element to add a data attr. Worst case, it can remember it by its ID or add a generated one.

    // When we load a new page with existing annotations:
    browser.devtools.inspectedWindow.eval(`document.querySelectorAll("[data-fathom]")[0].id`).then(updateUi);
}
initPanel();
