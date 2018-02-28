/**
 * This holds references to DOM elements on behalf of our devtools panel which,
 * since it runs in a different process, can't get ahold of them. (You see this
 * in the documented limitations of inspectedWindow.eval(), which can pass only
 * simple JSON objects around.) Essentially, this is the controller, and the
 * dev panel is the view.
 */
// How do we get the reference from $0 into the content script, which can add the data attr? Worst case, we can pass a path based on child numbers: root.2.4.3.1.

/**
 * Top-level dispatcher for commands sent from the devpanel to this content
 * script
 */
function dispatch(request) {
    if (request.type === 'label') {
        document.getElementById(request.element).setAttribute('data-fathom', 'boogled!');
    }
    return Promise.resolve({response: 'Here are the elements with Fathom data attrs.'});
}
browser.runtime.onMessage.addListener(dispatch);

console.log('I am the content script!');
