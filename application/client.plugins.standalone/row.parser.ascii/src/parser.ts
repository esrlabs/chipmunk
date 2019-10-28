// tslint:disable:object-literal-sort-keys
import * as Toolkit from 'chipmunk.client.toolkit';
import { default as AnsiUp } from 'ansi_up';

const ansiup = new AnsiUp();
ansiup.escape_for_html = false;

const REGS = {
    COLORS: /\x1b\[[\d;]{1,}[mG]/,
    COLORS_GLOBAL: /\x1b\[[\d;]{1,}[mG]/g,
};

const ignoreList: { [key: string]: boolean } = {};

export class ASCIIColorsParser extends Toolkit.ARowCommonParser {

    public parse(str: string, themeTypeRef: Toolkit.EThemeType, row: Toolkit.IRowInfo): string {
        if (typeof row.sourceName === "string") {
            if (ignoreList[row.sourceName] === undefined) {
                ignoreList[row.sourceName] = row.sourceName.search(/\.dlt$/gi) !== -1;
            }

            if (!ignoreList[row.sourceName]) {
                if (row.hasOwnStyles) {
                    // Only strip ANSI escape-codes
                    return str.replace(REGS.COLORS_GLOBAL, "");
                } else if (REGS.COLORS.test(str)) {
                    // ANSI escape-codes to html color-styles
                    return ansiup.ansi_to_html(str);
                }
            }
        }

        return str;
    }
}
