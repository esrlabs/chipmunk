function copyText(text: string) {

    if (typeof text !== 'string') {
        return false;
    }

    const element           = document.createElement('P');
    element.style.opacity   = '0.0001';
    element.style.position  = 'absolute';
    element.style.width     = '1px';
    element.style.height    = '1px';
    element.style.overflow  = 'hidden';
    element.innerHTML       = text.replace(/[\n\r]/gi, '</br>');
    document.body.appendChild(element);

    const range             = document.createRange();
    const selection         = window.getSelection();

    range.selectNode(element);

    selection.empty();
    selection.addRange(range);

    document.execCommand('copy');

    document.body.removeChild(element);

    return true;
}

export { copyText }

