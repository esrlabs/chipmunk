export const scheme_color_0 = '#FFFFFF';
export const scheme_color_1 = '#eaeaea';
export const scheme_color_2 = '#c0c0c0';
export const scheme_color_3 = '#979797';
export const scheme_color_4 = '#555555';
export const scheme_color_5 = '#333333';
export const scheme_color_6 = '#111111';

const colorsCache: Map<string, string> = new Map();

export function shadeColor(color: string, percent: number) {
    // source: https://stackoverflow.com/questions/5560248/programmatically-lighten-or-darken-a-hex-color-or-rgb-and-blend-colors

    const key: string = `${color}${percent}`;
    const cached: string | undefined = colorsCache.get(key);
    if (cached !== undefined) {
        return cached;
    }
    let R = parseInt(color.substring(1, 3), 16);
    let G = parseInt(color.substring(3, 5), 16);
    let B = parseInt(color.substring(5, 7), 16);

    R = R * (100 + percent) / 100;
    G = G * (100 + percent) / 100;
    B = B * (100 + percent) / 100;

    R = (R < 255) ? R : 255;
    G = (G < 255) ? G : 255;
    B = (B < 255) ? B : 255;

    const RR = ((R.toString(16).length === 1) ? '0' + R.toString(16) : R.toString(16));
    const GG = ((G.toString(16).length === 1) ? '0' + G.toString(16) : G.toString(16));
    const BB = ((B.toString(16).length === 1) ? '0' + B.toString(16) : B.toString(16));

    const result: string = '#' + RR.substr(0, 2) + GG.substr(0, 2) + BB.substr(0, 2);
    colorsCache.set(key, result);
    return result;
}

export function getContrastColor (hex: string, bw: boolean = false) {
    function padZero(str: string, len?: number) {
        len = len || 2;
        const zeros = new Array(len).join('0');
        return (zeros + str).slice(-len);
    }
    if (hex.indexOf('#') === 0) {
        hex = hex.slice(1);
    }
    // convert 3-digit hex to 6-digits.
    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    if (hex.length !== 6) {
        throw new Error('Invalid HEX color.');
    }
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    if (bw) {
        // http://stackoverflow.com/a/3943023/112731
        return (r * 0.299 + g * 0.587 + b * 0.114) > 186
            ? '#000000'
            : '#FFFFFF';
    }
    // pad each with zeros and return
    return '#' + padZero((255 - r).toString(16)) + padZero((255 - g).toString(16)) + padZero((255 - b).toString(16));
    // https://stackoverflow.com/questions/35969656/how-can-i-generate-the-opposite-color-according-to-current-color
}
