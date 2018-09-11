/**
 * Save the given HTML to the user's downloads folder.
 */
async function download(html, options = {}) {
    const blob = new Blob([html], {type: 'text/html'});
    const url = URL.createObjectURL(blob);

    // Save html using the specified filename as a template.
    let downloadId = await browser.downloads.download({
        url,
        filename: options.filename || 'Untitled.html',
        saveAs: options.saveAs || false,
    });

    // Give it 10 seconds; FF can be a bit slow.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000 * 10);

    // Return the basename of the chosen filename.
    let filename = (await browser.downloads.search({id: downloadId}))[0].filename;
    return filename.replace(/^.*\//, '');
}
