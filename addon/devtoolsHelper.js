/**
 * This holds references to DOM elements on behalf of our devtools panel which,
 * since it runs in a different process, can't get ahold of them. (You see this
 * in the documented limitations of inspectedWindow.eval(), which can pass only
 * simple JSON objects around.) Essentially, this is the controller, and the
 * dev panel is the view.
 */

/**
 * Top-level dispatcher for commands sent from the devpanel to this content
 * script
 */
function dispatch(request) {
    if (request.type === 'label') {
        elementAtPath(request.elementPath, document).setAttribute('data-fathom', request.label);
    }
    return Promise.resolve({response: 'Here are the elements with Fathom data attrs.'});
}
browser.runtime.onMessage.addListener(dispatch);
