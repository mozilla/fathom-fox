import freezeDry from 'freeze-dry';

function tellBackgroundPage() {
    browser.runtime.sendMessage('from content with love');
}

tellBackgroundPage();