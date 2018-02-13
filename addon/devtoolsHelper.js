/**
 * This holds references to DOM elements on behalf of our devtools panel which,
 * since it runs in a different process, can't get ahold of them. (You see this
 * in the documented limitations of inspectedWindow.eval(), which can pass only
 * simple JSON objects around.) Essentially, this is the controller, and the
 * dev panel is the view.
 */
// See if we can get the devtools and this to talk via messages so this can be the controller (and hold state) and the devtools pane can just be the view. Also, how do we get the reference from $0 into the content script?

function returnStuff(request) {
    console.log('CS received:', request.type);  // NEXT: Why do I get <unavailable> here?
    return Promise.resolve({response: 'Hi from cs!'});
}
browser.runtime.onMessage.addListener(returnStuff);

console.log('I am the content script!');