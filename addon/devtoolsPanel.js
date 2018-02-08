/**
 * Return whether the result from an inspectedWindow.eval() call was an error.
 * Log it if it was.
 */
function isError(result) {
    if (result[0] === undefined) {
        const error = result[1];
        if (error.isError) {
            console.log(`Devtools error: ${error.code}`);
        } else {
            console.log(`JavaScript error: ${error.value}`);
        }
        return true;
    }
    return false;
}

/**
Handle the result of evaluating the jQuery test script.
Log the result of the test, or
if there was an error, call handleError.
*/
function handlejQueryResult(result) {
    if (!isError(result)) {
        console.log(`id: ${result[0]}`);
    }
}
/**
When the user clicks the 'jquery' button,
evaluate the jQuery script.
*/
const checkjQuery = '$0.id';
document.getElementById('button_jquery').addEventListener('click', () => {
  browser.devtools.inspectedWindow.eval(checkjQuery)
    .then(handlejQueryResult);
});

/**
 * Update the GUI to reflect the currently inspected page the first time the
 * panel loads.
 *
 * When you navigate to a new page, the Console pane comes forward, so this re-
 * runs when the Fathom pane is brought forward again.
 */
async function initPanel() {
    const result = await browser.devtools.inspectedWindow.eval(
        'document.querySelectorAll("[data-fathom]")[0].getAttribute("data-fathom")');
    if (!isError(result)) {
        console.log(result[0]);
    }
    // I don't seem able to pass DOM elements from the eval() context back into the panel. Simple values are fine. The docs, in fact, say only JSON values can be passed.
}
initPanel();