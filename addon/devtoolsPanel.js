/**
Handle errors from the injected script.
Errors may come from evaluating the JavaScript itself
or from the devtools framework.
See https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/devtools.inspectedWindow/eval#Return_value
*/
function handleError(error) {
  if (error.isError) {
    console.log(`Devtools error: ${error.code}`);
  } else {
    console.log(`JavaScript error: ${error.value}`);
  }
}

/**
Handle the result of evaluating the jQuery test script.
Log the result of the test, or
if there was an error, call handleError.
*/
function handlejQueryResult(result) {
  if (result[0] !== undefined) {
    console.log(`id: ${result[0]}`);
  } else if (result[1]) {
    handleError(result[1]);
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
