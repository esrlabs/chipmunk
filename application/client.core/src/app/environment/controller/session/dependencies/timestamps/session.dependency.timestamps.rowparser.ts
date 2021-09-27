import { Modifier, IRowInfo, EThemeType, RowCommonParser } from 'chipmunk.client.toolkit';
import * as Toolkit from 'chipmunk.client.toolkit';

export class TimestampRowParser extends RowCommonParser {
    private _parser: (str: string) => string | Toolkit.Modifier;

    constructor(parser: (str: string) => string | Toolkit.Modifier) {
        super();
        this._parser = parser;
    }

    public parse(str: string, themeTypeRef: EThemeType, row: IRowInfo): string | Modifier {
        return this._parser(str);
    }
}
