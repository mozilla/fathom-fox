/**
 * Save the given HTML to the user's downloads folder.
 */
async function download(html, options = {}) {
    const blob = new Blob([html], {type: 'text/html'});
    const url = URL.createObjectURL(blob);

    // Revoke the url object when the download has completed.
    function handleChanged(delta) {
        if (delta.state && delta.state.current === "complete") {
            URL.revokeObjectURL(url);
            browser.downloads.onChanged.removeListener(handleChanged);
        }
    }
    browser.downloads.onChanged.addListener(handleChanged);

    // Save html using the specified filename as a template.
    let downloadId = await browser.downloads.download({
        url,
        filename: options.filename || 'Untitled.html',
        saveAs: options.saveAs || false,
    });

    // Return the basename of the chosen filename.
    let filename = (await browser.downloads.search({id: downloadId}))[0].filename;
    return filename.replace(/^.*\//, '');
}
