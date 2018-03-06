/**
 * Return the DOM element indicated by an array of offsets as described in
 * elementPath().
 */
function elementAtPath(path, document) {
    let node = document;
    for (const index of reversed(path)) {
        node = node.children[index];
    }
    return node;
}

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

/**
 * Return an backward iterator over an Array.
 */
function *reversed(array) {
    for (let i = array.length - 1; i >= 0; i--) {
        yield array[i];
    }
}
