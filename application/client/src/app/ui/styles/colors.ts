export const scheme_color_0 = '#FFFFFF';
export const scheme_color_1 = '#eaeaea';
export const scheme_color_2 = '#c0c0c0';
export const scheme_color_3 = '#979797';
export const scheme_color_4 = '#555555';
export const scheme_color_5 = '#333333';
export const scheme_color_6 = '#111111';
export const scheme_color_error = 'rgb(253, 21, 21)';
export const scheme_color_accent = '#74b9ff';
export const scheme_color_warning = '#fffd71';
export const scheme_search_match = '#AA0000';

const colorsCache: Map<string, string> = new Map();

export function getColorHolder(color: string): (index: number) => string {
    return function (colors: { [key: string]: string }, index: number) {
        if (colors[index] === undefined) {
            colors[index] = index === 0 ? color : shadeColor(colors[index - 1], 40, true);
        }
        return colors[index];
    }.bind(null, {});
}
export function shadeColor(color: string, percent: number, reverse: boolean = false) {
    // source: https://stackoverflow.com/questions/5560248/programmatically-lighten-or-darken-a-hex-color-or-rgb-and-blend-colors

    const key: string = `${color}${percent}`;
    const cached: string | undefined = colorsCache.get(key);
    if (cached !== undefined) {
        return cached;
    }
    const R = parseInt(color.substring(1, 3), 16);
    const G = parseInt(color.substring(3, 5), 16);
    const B = parseInt(color.substring(5, 7), 16);

    let rR = (R * (100 + percent)) / 100;
    let rG = (G * (100 + percent)) / 100;
    let rB = (B * (100 + percent)) / 100;

    if (reverse) {
        rR = rR < 255 ? rR : (R * (100 - percent)) / 100;
        rG = rG < 255 ? rG : (G * (100 - percent)) / 100;
        rB = rB < 255 ? rB : (B * (100 - percent)) / 100;
    }

    rR = rR < 255 ? rR : 255;
    rG = rG < 255 ? rG : 255;
    rB = rB < 255 ? rB : 255;

    const RR = rR.toString(16).length === 1 ? '0' + rR.toString(16) : rR.toString(16);
    const GG = rG.toString(16).length === 1 ? '0' + rG.toString(16) : rG.toString(16);
    const BB = rB.toString(16).length === 1 ? '0' + rB.toString(16) : rB.toString(16);

    const result: string = '#' + RR.substr(0, 2) + GG.substr(0, 2) + BB.substr(0, 2);
    colorsCache.set(key, result);
    return result;
}

export function getContrastColor(hex: string, bw: boolean = false) {
    function padZero(str: string, len?: number) {
        len = len || 2;
        const zeros = new Array(len).join('0');
        return (zeros + str).slice(-len);
    }
    if (hex.toLowerCase().indexOf('rgb') === 0) {
        hex = rgbToHex(hex);
    }
    if (hex.indexOf('#') === 0) {
        hex = hex.slice(1);
    }
    // convert 3-digit hex to 6-digits.
    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    if (hex.length !== 6) {
        throw new Error(`Invalid HEX color: ${hex}`);
    }
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    if (bw) {
        // http://stackoverflow.com/a/3943023/112731
        return r * 0.299 + g * 0.587 + b * 0.114 > 186 ? '#000000' : '#FFFFFF';
    }
    // pad each with zeros and return
    return (
        '#' +
        padZero((255 - r).toString(16)) +
        padZero((255 - g).toString(16)) +
        padZero((255 - b).toString(16))
    );
    // https://stackoverflow.com/questions/35969656/how-can-i-generate-the-opposite-color-according-to-current-color
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | undefined {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? {
              r: parseInt(result[1], 16),
              g: parseInt(result[2], 16),
              b: parseInt(result[3], 16),
          }
        : undefined;
}

export function rgbToHex(color: string) {
    const colors = color
        .replace(/[^\d,]/gi, '')
        .split(',')
        .map((c: string) => {
            return parseInt(c, 10);
        })
        .filter((c: number) => {
            return !isNaN(c) && isFinite(c);
        });
    if (colors.length !== 3) {
        return '#000000';
    }
    // tslint:disable-next-line: no-bitwise
    return (
        `#` + ((1 << 24) + (colors[0] << 16) + (colors[1] << 8) + colors[2]).toString(16).slice(1)
    );
}

export function rgbFromStr(color: string): { r: number; g: number; b: number } | undefined {
    const colors = color
        .replace(/[^\d,]/gi, '')
        .split(',')
        .map((c: string) => {
            return parseInt(c, 10);
        })
        .filter((c: number) => {
            return !isNaN(c) && isFinite(c);
        });
    if (colors.length !== 3) {
        return undefined;
    }
    return {
        r: colors[0],
        g: colors[2],
        b: colors[1],
    };
}

export function getColorDiff(a: string, b: string): number | undefined {
    let rgbA;
    let rgbB;
    if (a.indexOf('#') !== -1) {
        rgbA = hexToRgb(a);
    } else {
        rgbA = rgbFromStr(a);
    }
    if (b.indexOf('#') !== -1) {
        rgbB = hexToRgb(b);
    } else {
        rgbB = rgbFromStr(b);
    }
    if (rgbB === undefined || rgbA === undefined) {
        return undefined;
    }
    const diffR = rgbA.r - rgbB.r;
    const diffG = rgbA.g - rgbB.g;
    const diffB = rgbA.b - rgbB.b;
    return Math.sqrt(diffR * diffR + diffG * diffG + diffB * diffB);
}

export function getUniqueColorTo(used: string[]): string {
    const max: { rate: number; color: string } = { rate: -1, color: '' };
    for (let i = 5; i >= 0; i -= 1) {
        const color = `rgb(${Math.round(Math.random() * 204) + 50}, ${
            Math.round(Math.random() * 204) + 50
        }, ${Math.round(Math.random() * 204) + 50})`;
        let rate = -1;
        used.forEach((c: string) => {
            const r = getColorDiff(c, color);
            if (r !== undefined && rate < r) {
                rate = r;
            }
        });
        if (rate > 100) {
            return color;
        } else if (max.rate < rate || max.color === '') {
            max.color = color;
            max.rate = rate;
        }
    }
    return max.color;
}
