export const scheme_color_0 = '#FFFFFF';
export const scheme_color_1 = '#eaeaea';
export const scheme_color_2 = '#c0c0c0';
export const scheme_color_3 = '#979797';
export const scheme_color_4 = '#555555';
export const scheme_color_5 = '#333333';
export const scheme_color_6 = '#111111';

const colorsCache: Map<string, string> = new Map();

export function shadeColor(color: string, percent: number) {
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
