export function serializeHtml(str: string): string {
    return str.replace(/</gi, '&lt;').replace(/>/gi, '&gt;');
}
