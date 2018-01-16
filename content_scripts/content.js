import freezeDry from 'freeze-dry';

function tellBackgroundPage() {
    browser.runtime.sendMessage(document.getElementById('banner').innerText);
}

tellBackgroundPage();