export function log(s: any) {
    if (typeof s === 'string') {
        console.log("[JS]: %d: %s", new Date().getTime(), s);
    } else {
        console.log(s);
    }
}
