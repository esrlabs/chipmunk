export function copyTextToClipboard(text: string | string[]) {
    let str = text instanceof Array ? text.join('\n\r') : text;
    [
        { r: /\u00a0/g, m: '&nbsp;' },
        { r: /\t/g, m: '&#9;' },
        { r: /</g, m: '&lt;' },
        { r: />/g, m: '&gt;' },
        { r: /[\n\r]/g, m: '&#13;&#10;' },
        { r: /\s/g, m: '&nbsp;' }, // &#32;
        { r: /&#9;/g, m: '\u0009' },
    ].forEach((toBeChecked) => {
        str = str.replace(toBeChecked.r, toBeChecked.m);
    });
    // Oldschool (modern class Clipboard gives exeptions for this moment: 13.09.2019)
    const selection = document.getSelection();
    const element = document.createElement('pre'); // This is important to use tag <PRE> - it allows delivery into clipboard such "things" like tabs
    element.style.opacity = '0.0001';
    element.style.position = 'absolute';
    element.style.userSelect = 'all';
    element.style.width = '1px';
    element.style.height = '1px';
    element.style.overflow = 'hidden';
    element.className = 'noreset';
    element.innerHTML = str;
    document.body.appendChild(element);
    const range = document.createRange();
    range.selectNode(element);
    if (selection !== null) {
        selection.empty();
        selection.addRange(range);
        document.execCommand('copy');
        selection.empty();
    }
    document.body.removeChild(element);
}

export function readTextFromClipboard(): Promise<string> {
    return navigator.clipboard.readText();
}
