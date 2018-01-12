const leftPad = require("left-pad");

const el = document.getElementById.bind(document);
const resultNode = el("result");
const textNode = el("text");
const amountNode = el("amount");
const withNode = el("with");

el("leftpad-form").addEventListener("submit", (e) => {
    e.preventDefault();

    console.log("padding");
    resultNode.value = leftPad(textNode.value, amountNode.valueAsNumber, withNode.value);
}, false);

el("pad-bg").addEventListener("click", (e) => {
    var sendingMessage = browser.runtime.sendMessage({
        text: textNode.value,
        amount: amountNode.valueAsNumber,
        with: withNode.value
    });
    sendingMessage.then((result) => {
      resultNode.value = result;
    });
});
