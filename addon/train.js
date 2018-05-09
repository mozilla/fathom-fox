async function trainOnTabs() {
    // Grey out Train button:
    document.getElementById('train').disabled = true;

    // TODO: Using "active" here rather than a tab ID presents a race condition
    // if you quickly switch away from the tab after clicking the Train button.
    const tabs = (await browser.tabs.query({currentWindow: true, active: false}));
    //await setViewportSize(tabs[0], 1024, 768);  // for consistent element sizing in samples due to text wrap, etc.

    for (const tab of tabs) {
        console.log(tab.title);
    }

    // Clean up:
    document.getElementById('train').disabled = false;
}
document.getElementById('train').onclick = trainOnTabs;
