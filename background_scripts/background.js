const leftPad = require("left-pad");

function go() {
    console.log('gone!');
}

browser.browserAction.onClicked.addListener(go);
