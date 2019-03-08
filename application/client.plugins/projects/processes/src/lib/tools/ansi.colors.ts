// tslint:disable:max-line-length
// tslint:disable:no-inferrable-types


// Base: https://en.wikipedia.org/wiki/ANSI_escape_code
const RegExps = {
    color: /\x1b\[([0-9;]*)m/gi
};

class AnsiColorDefinition {

    private _value: string;
    private readonly _map: { [key: string]: (key: string, params: string[]) => string } = {
        '0': this._fn_drop.bind(this), '1': this._fn_bold.bind(this), '2': this._fn_ubold.bind(this), '3': this._fn_italic, '4': this._fn_underline.bind(this),
        '5': this._fn_dummy.bind(this), '6': this._fn_dummy.bind(this), '7': this._fn_dummy.bind(this), '8': this._fn_dummy.bind(this), '9': this._fn_dummy.bind(this),
        '10': this._fn_dummy.bind(this), '11': this._fn_dummy.bind(this), '12': this._fn_dummy.bind(this), '13': this._fn_dummy.bind(this), '14': this._fn_dummy.bind(this),
        '15': this._fn_dummy.bind(this), '16': this._fn_dummy.bind(this), '17': this._fn_dummy.bind(this), '18': this._fn_dummy.bind(this), '19': this._fn_dummy.bind(this),
        '20': this._fn_dummy.bind(this), '21': this._fn_dummy.bind(this), '22': this._fn_dummy.bind(this), '23': this._fn_nounderline.bind(this), '24': this._fn_nounderline.bind(this),
        '25': this._fn_dummy.bind(this), '26': this._fn_dummy.bind(this), '27': this._fn_dummy.bind(this), '28': this._fn_dummy.bind(this), '29': this._fn_dummy.bind(this),
        '30': this._fn_foreground.bind(this), '31': this._fn_foreground.bind(this), '32': this._fn_foreground.bind(this), '33': this._fn_foreground.bind(this), '34': this._fn_foreground.bind(this),
        '35': this._fn_foreground.bind(this), '36': this._fn_foreground.bind(this), '37': this._fn_foreground.bind(this), '38': this._fn_foreground.bind(this), '39': this._fn_foreground.bind(this),
        '40': this._fn_background.bind(this), '41': this._fn_background.bind(this), '42': this._fn_background.bind(this), '43': this._fn_background.bind(this), '44': this._fn_background.bind(this),
        '45': this._fn_background.bind(this), '46': this._fn_background.bind(this), '47': this._fn_background.bind(this), '48': this._fn_background.bind(this), '49': this._fn_background.bind(this),
        '50': this._fn_dummy.bind(this), '51': this._fn_dummy.bind(this), '52': this._fn_dummy.bind(this), '53': this._fn_dummy.bind(this), '54': this._fn_dummy.bind(this),
        '55': this._fn_dummy.bind(this), '56': this._fn_dummy.bind(this), '57': this._fn_dummy.bind(this), '58': this._fn_dummy.bind(this), '59': this._fn_dummy.bind(this),
        '60': this._fn_dummy.bind(this), '61': this._fn_dummy.bind(this), '62': this._fn_dummy.bind(this), '63': this._fn_dummy.bind(this), '64': this._fn_dummy.bind(this),
        '65': this._fn_dummy.bind(this),
    };
    private readonly _mapLength: { [key: string]: number } = {
        '0': 0, '1': 0, '2': 0, '3': 0, '4': 0,
        '5': 0, '6': 0, '7': 0, '8': 0, '9': 0,
        '10': 0, '11': 0, '12': 0, '13': 0, '14': 0,
        '15': 0, '16': 0, '17': 0, '18': 0, '19': 0,
        '20': 0, '21': 0, '22': 0, '23': 0, '24': 0,
        '25': 0, '26': 0, '27': 0, '28': 0, '29': 0,
        '30': 0, '31': 0, '32': 0, '33': 0, '34': 0,
        '35': 0, '36': 0, '37': 0, '38': 0, '39': 0,
        '40': 0, '41': 0, '42': 0, '43': 0, '44': 0,
        '45': 0, '46': 0, '47': 0, '48': 0, '49': 0,
        '50': 0, '51': 0, '52': 0, '53': 0, '54': 0,
        '55': 0, '56': 0, '57': 0, '58': 0, '59': 0,
        '60': 0, '61': 0, '62': 0, '63': 0, '64': 0,
        '65': 0,
    };

    constructor(value: string) {
        this._value = value;
    }

    public getStyle(): string {
        const parts: string[] = this._value.split(';');
        let styles: string = '';
        do {
            const key: string = parts[0];
            if (!this._isKeyValid(key)) {
                // Here is should be some log message, because key is unknown
                parts.splice(0, 1);
            } else {
                // Remove current key
                parts.splice(0, 1);
                // Get styles
                styles += this._map[key](key, parts);
            }
        } while (parts.length > 0);
        return styles;
    }

    private _isKeyValid(key: string): boolean {
        return this._mapLength[key] !== undefined;
    }

    private _decode8BitAnsiColor(ansi: number): string {
        // https://gist.github.com/MightyPork/1d9bd3a3fd4eb1a661011560f6921b5b
        const low_rgb = [
            '#000000', '#800000', '#008000', '#808000', '#000080', '#800080', '#008080', '#c0c0c0',
            '#808080', '#ff0000', '#00ff00', '#ffff00', '#0000ff', '#ff00ff', '#00ffff', '#ffffff'
        ];
        if (ansi < 0 || ansi > 255)  { return '#000'; }
        if (ansi < 16) { return low_rgb[ansi]; }

        if (ansi > 231) {
          const s = (ansi - 232) * 10 + 8;
          return `rgb(${s},${s},${s})`;
        }

        const n = ansi - 16;
        let b = n % 6;
        let g = (n - b) / 6 % 6;
        let r = (n - b - g * 6) / 36 % 6;
        b = b ? b * 40 + 55 : 0;
        r = r ? r * 40 + 55 : 0;
        g = g ? g * 40 + 55 : 0;

        return `rgb(${r},${g},${b})`;
    }

    private _fn_bold(key: string, params: string[]): string {
        return 'fontWeight: bold;';
    }

    private _fn_ubold(key: string, params: string[]): string {
        return 'fontWeight: normal;';
    }

    private _fn_italic(key: string, params: string[]): string {
        return 'fontStyle: italic;';
    }

    private _fn_underline(key: string, params: string[]): string {
        return 'textDecoration: underline;';
    }

    private _fn_nounderline(key: string, params: string[]): string {
        return 'textDecoration: none;';
    }

    private _fn_foreground(key: string, params: string[]): string {
        switch (key) {
            case '30':
                return 'color: rgb(0,0,0);';
            case '31':
                return 'color: rgb(170,0,0);';
            case '32':
                return 'color: rgb(0,170,0);';
            case '33':
                return 'color: rgb(170,85,0);';
            case '34':
                return 'color: rgb(0,0,170);';
            case '35':
                return 'color: rgb(170,0,170);';
            case '36':
                return 'color: rgb(0,170,170);';
            case '37':
                return 'color: rgb(170,170,170);';
            case '38':
                if (params[0] === '5' && params.length >= 2) {
                    const cut = params.splice(0, 2);
                    return `color: ${this._decode8BitAnsiColor(parseInt(cut[1], 10))};`;
                } else if (params[0] === '2' && params.length >= 4) {
                    const cut = params.splice(0, 4);
                    return `color: rgb(${cut[1]}, ${cut[2]}, ${cut[3]});`;
                } else {
                    return '';
                }
            case '39':
                return 'color: inherit;';
            default:
                return '';
        }
    }

    private _fn_background(key: string, params: string[]): string {
        switch (key) {
            case '40':
                return 'backgroundColor: rgb(0,0,0);';
            case '41':
                return 'backgroundColor: rgb(128,0,0);';
            case '42':
                return 'backgroundColor: rgb(0,128,0);';
            case '43':
                return 'backgroundColor: rgb(128,128,0);';
            case '44':
                return 'backgroundColor: rgb(0,0,128);';
            case '45':
                return 'backgroundColor: rgb(128,0,128);';
            case '46':
                return 'backgroundColor: rgb(0,128,128);';
            case '47':
                return 'backgroundColor: rgb(192,192,192);';
            case '48':
                if (params[0] === '5' && params.length >= 2) {
                    const cut = params.splice(0, 2);
                    return `backgroundColor: ${this._decode8BitAnsiColor(parseInt(cut[1], 10))};`;
                } else if (params[0] === '2' && params.length >= 4) {
                    const cut = params.splice(0, 4);
                    return `backgroundColor: rgb(${cut[1]}, ${cut[2]}, ${cut[3]});`;
                } else {
                    return '';
                }
            case '49':
                return 'backgroundColor: inherit;';
            default:
                return '';
        }
    }

    private _fn_drop(key: string, params: string[]): string {
        return '';
    }

    private _fn_dummy(key: string, params: string[]): string {
        return '';
    }

}

export class AnsiEscapeSequencesColors {

    constructor() {

    }

    public getHTML(input: string): string {
        let opened: number = 0;
        input = input.replace(RegExps.color, (substring: string, match: string, offset: number, whole: string) => {
            const styleDef: AnsiColorDefinition = new AnsiColorDefinition(match);
            const style: string = styleDef.getStyle();
            opened ++;
            return style !== '' ? `<span style="${style}">` : `<span>`;
        });
        input += `</span>`.repeat(opened);
        input = input.replace(/<span><\/span>/gi, '');
        return input;
    }

}
