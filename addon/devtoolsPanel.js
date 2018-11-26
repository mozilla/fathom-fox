let backgroundPort = browser.runtime.connect();

function initPanel() {
    // Initialise freeze-page button:
    document.getElementById('freeze-button').addEventListener('click', () => {
        document.getElementById('freeze-button').disabled = true;
        document.getElementById('spinner-container').classList.remove('hidden');
        inspectedElementSelector()
            .then((selector) => {
                backgroundPort.postMessage({
                    type: 'freeze',
                    tabId: browser.devtools.inspectedWindow.tabId,
                    selector: selector,
                    options: {shouldScroll: false, wait: 0},
                });
            }).catch((e) => {
                console.error(e);
            });
    });

    // Initialise content-script:
    backgroundPort.postMessage({
        type: 'init',
        tabId: browser.devtools.inspectedWindow.tabId,
    });

    // And initialise the UI:
    updateLabeled();
}
initPanel();

// Handle requests from background script.
browser.runtime.onMessage.addListener((request) => {
    if (request.type === 'init') {
        resetFreeze();
        backgroundPort.postMessage({
            type: 'init',
            tabId: browser.devtools.inspectedWindow.tabId,
        });
        updateLabeled();
    } else if (request.type === 'refresh') {
        resetFreeze();
        browser.runtime.sendMessage({type: 'init'})
            .then(updateLabeled)
            .catch((error) => {
                console.error(error);
            });
    }
});

// Restore the freeze button and spinner back to original state.
function resetFreeze() {
    document.getElementById('freeze-button').disabled = false;
    document.getElementById('spinner-container').classList.add('hidden');
}

// Returns a list of objects with the following attributes:
//   preview: html preview of element
//   label: the fathom label, or an empty string if unlabeled
//   path: css path to element
//   inspected: true if this element === $0
function getLabeled() {
    let evalScript = `
        (function getLabeled() {
            // Truncate a string, and return it. Append an ellipsis or
            // something if the string was long enough to truncate.
            function abbreviate(str, length, ellipsis) {
                if (str.length > length) {
                    return str.slice(0, length) + ellipsis;
                } else {
                    return str;
                }
            }

            function elementMeta(el, isInspected) {
                return {
                    preview: abbreviate(el.outerHTML, 200, '...>').replace(/^([^>]+>)[\\s\\S]*$/, '$1'),
                    label: el.dataset.fathom || '',
                    path: Simmer.configure({depth: 25})(el),
                    inspected: isInspected,
                };
            }

            let list = [];
            if ($0) {
                list.push(elementMeta($0, true));
            }
            for (const el of document.querySelectorAll('[data-fathom]')) {
                if ($0 && el === $0) {
                    continue;
                }
                list.push(elementMeta(el, false));
            }
            return list;
        })();
    `;
    return resultOfEval(evalScript);
}

// Draw the table with the list of existing labeled elements (as generated
// by `getLabeled()`.
// If an element is inspected/selected with devtools (i.e. $0 is defined), it
// will always be the first row in the table.
function updateLabeledTable(labeled) {

    function addTextCell(row, text, isHeader=false) {
        const td = document.createElement(isHeader ? 'th' : 'td');
        td.appendChild(document.createTextNode(text));
        row.appendChild(td);
        return td;
    }

    function inspectLabeled(event) {
        event.preventDefault();
        const escapedPath = event.target.dataset.path.replace(/"/g, '\\"');
        const js = 'inspect(document.querySelector("' + escapedPath + '"))';
        browser.devtools.inspectedWindow.eval(js)
            .catch((e) => {
                console.error(e);
            });
    }

    function addErrorRow(table, error) {
        const row = document.createElement('tr');
        row.classList.add('error');
        addTextCell(row, error).setAttribute('colspan', '3');
        table.appendChild(row);
    }

    function addPathCell(row, label) {
        const td = document.createElement('td');
        td.classList.add('path');
        if (label.inspected) {
            td.appendChild(document.createTextNode(label.path));
        } else {
            let a = document.createElement('a');
            a.href = '#';
            a.dataset.path = label.path;
            a.addEventListener('click', inspectLabeled);
            a.appendChild(document.createTextNode(label.path));
            td.appendChild(a);
        }
        row.appendChild(td);
    }

    function updateLabel(event) {
        backgroundPort.postMessage({
            type: 'label',
            tabId: browser.devtools.inspectedWindow.tabId,
            selector: event.target.dataset.path,
            label: event.target.value.trim(),
        });
    }

    function addLabelCell(row, label) {
        const td = document.createElement('td');
        td.classList.add('label');
        const input = document.createElement('input');
        input.setAttribute('placeholder', 'unlabeled');
        input.value = label.label;
        input.dataset.path = label.path;
        input.addEventListener('change', updateLabel);
        td.appendChild(input);
        row.appendChild(td);
        if (label.inspected) {
            input.setAttribute('id', 'inspectedLabel');
        }
    }

    function removeLabeled(event) {
        event.preventDefault();
        backgroundPort.postMessage({
            type: 'label',
            tabId: browser.devtools.inspectedWindow.tabId,
            selector: event.target.dataset.path,
            label: '',
        });
    }

    function addClearLabelCell(row, label) {
        const td = document.createElement('td');
        td.classList.add('action');
        const a = document.createElement('a');
        a.href = '#';
        a.classList.add('action-button');
        a.dataset.path = label.path;
        a.dataset.label = label.label;
        a.setAttribute('title', 'Remove Label');
        a.addEventListener('click', removeLabeled);
        a.appendChild(document.createTextNode('✖'));
        td.appendChild(a);
        row.appendChild(td);
    }

    const table = document.createElement('table');
    const headerRow = document.createElement('tr');
    addTextCell(headerRow, 'Selector (click to inspect)', true).classList.add('path');
    addTextCell(headerRow, 'Element', true).classList.add('preview');
    addTextCell(headerRow, 'Label', true).classList.add('label');
    addTextCell(headerRow, '').classList.add('action');
    table.appendChild(headerRow);

    for (const label of labeled) {
        if (!label.path) {
            addErrorRow(table, 'Failed to calculate CSS selector for the inspected element');
            continue;
        }

        const row = document.createElement('tr');
        row.classList.add('hover');

        addPathCell(row, label);
        addTextCell(row, label.preview).classList.add('preview');
        addLabelCell(row, label);
        if (!label.inspected) {
            addClearLabelCell(row, label);
        }

        table.appendChild(row);
    }

    const container = document.getElementById('labels');
    emptyElement(container);
    container.appendChild(table);
}

// Update the UI to show either the table of labeled elements, or
// a message informing the user to use the inspection panel.
function updateLabeled() {
    getLabeled()
        .then((labeled) => {
            updateLabeledTable(labeled);

            if (labeled.length === 0) {
                // nothing inspected or already labeled
                document.getElementById('no-selection').classList.remove('hidden');
                document.getElementById('no-labels').classList.add('hidden');
                document.getElementById('labels').classList.add('hidden');
            } else {
                // show labels table
                document.getElementById('no-labels').classList.add('hidden');
                document.getElementById('labels').classList.remove('hidden');
                // if the first item is unlabeled it's the inspected element
                if (labeled[0].inspected) {
                    // selection
                    document.getElementById('no-selection').classList.add('hidden');
                    const inspectedLabel = document.getElementById('inspectedLabel');
                    if (inspectedLabel) {
                        inspectedLabel.focus();
                    }
                } else {
                    // no selection
                    document.getElementById('no-selection').classList.remove('hidden');
                }


            }
        })
        .catch((error) => {
            console.error(error);
        });
}
