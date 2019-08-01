// tslint:disable:object-literal-sort-keys
import * as Toolkit from 'logviewer.client.toolkit';

const STYLES: { [key: string]: string } = {
    1   : 'font-weight: bold;',
    3   : 'font-style: italic;',
    4   : 'text-decoration: underline;',
    30  : 'color: black;',
    31  : 'color: red;',
    32  : 'color: green;',
    33  : 'color: yellow;',
    34  : 'color: blue;',
    35  : 'color: magenta;',
    36  : 'color: cyan;',
    37  : 'color: white;',
    40  : 'background-color: black;',
    41  : 'background-color: red;',
    42  : 'background-color: green;',
    43  : 'background-color: yellow;',
    44  : 'background-color: blue;',
    45  : 'background-color: magenta;',
    46  : 'background-color: cyan;',
    47  : 'background-color: white;',
};

const CBlockedStyles: { [key: string]: number[] } = {
    [Toolkit.EThemeType.dark]: [30, 47],
    [Toolkit.EThemeType.light]: [37, 40],
    [Toolkit.EThemeType.undefined]: [],
};

const REGS = {
    COLORS          : /\033\[[\d;]{1,}m[^\033]*/g,
    COLORS_VALUE    : /\033\[.*?m/g,
    CLEAR_COLORS    : /[\033\[m]/g,
    BEGIN           : /^[^\033]*/g,
};

export class ASCIIColorsParser extends Toolkit.ARowCommonParser {

    public parse(str: string, themeTypeRef: Toolkit.EThemeType, row: Toolkit.IRowInfo): string {
        const themeType: number[] | undefined = CBlockedStyles[themeTypeRef] === undefined ? [] : CBlockedStyles[themeTypeRef];
        const parts: RegExpMatchArray | null = str.match(REGS.COLORS);
        if (parts instanceof Array && parts.length > 1) {
            const _begin: RegExpMatchArray | null = str.match(REGS.BEGIN);
            let result: string = _begin instanceof Array ? (_begin.length > 0 ? _begin[0] : '') : '';
            parts.forEach((part: string) => {
                const values: RegExpMatchArray | null = part.match(REGS.COLORS_VALUE);
                const value: string | null = values instanceof Array ? (values.length === 1 ? values[0].replace(REGS.CLEAR_COLORS, '') : null) : null;
                let text: string = part.replace(REGS.COLORS_VALUE, '');
                let inlineStyle: string = '';
                if (value !== null) {
                    value.split(';').forEach((def: string) => {
                        const num: number = parseInt(def, 10);
                        if (themeType.indexOf(num) !== -1) {
                            return;
                        }
                        STYLES[def] !== void 0 && (inlineStyle += ' ' + STYLES[def]);
                    });
                    text = inlineStyle !== '' ? ('<span class="noreset" style="' + inlineStyle + '">' + text + '</span>') : text;
                }
                result = result + text;
            });
            return result;
        }
        return str;
    }

}
