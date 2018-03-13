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

/**
 * Return an "index path" to the element inspected by the dev tools.
 *
 * Callable only from devtools panels or openers.
 */
async function inspectedElementPath() {
    const inspectedElementPathSource = `
        (function pathOfElement(element) {
            function indexOf(arrayLike, item) {
                for (let i = 0; i < arrayLike.length; i++) {
                    if (arrayLike[i] === item) {
                        return i;
                    }
                }
                throw new Error('Item was not found in collection.');
            }

            const path = [];
            let node = element;
            while (node.parentNode !== null) {
                path.push(indexOf(node.parentNode.children, node));
                node = node.parentNode;
            }
            return path;
        })($0)
        `;
    return resultOfEval(inspectedElementPathSource);
}
