browser.devtools.panels.create(
  'Fathom',
  '/icons/leftpad-32.png',
  '/pages/devtoolsPanel.html'
).then((extensionPanel) => extensionPanel.onShown.addListener(panelShowed));

function panelShowed(extensionPanel) {
    const highlightInspectedElement = `
        (function highlightInspectedElement() {
            let highlighter = document.getElementById('fathomHighlighter');
            if (highlighter !== null) {
                highlighter.parentNode.removeChild(highlighter);
            }
            highlighter = document.createElement('div');
            highlighter.id = 'fathomHighlighter';
            highlighter.style.backgroundColor = '#92DDF4';
            highlighter.style.opacity = '.70';
            highlighter.style.position = 'absolute';
            const rect = $0.getBoundingClientRect();
            highlighter.style.width = rect.width + 'px';
            highlighter.style.height = rect.height + 'px';
            highlighter.style.top = rect.top + document.defaultView.pageYOffset + 'px';
            highlighter.style.left = rect.left + document.defaultView.pageXOffset + 'px';
            highlighter.style.padding = '0';
            highlighter.style.margin = '0';
            highlighter.style['border-radius'] = '0';
            document.getElementsByTagName('html')[0].appendChild(highlighter);
        })();
    `;
    // TODO: Pull data attrs into UI.

    // Highlight the inspected element. Firefox otherwise does nothing to make
    // clear that the inspector's selection is even preserved when a different
    // devpanel is forward.
    browser.devtools.inspectedWindow.eval(highlightInspectedElement);
}