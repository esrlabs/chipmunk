import { Modifier, IRowInfo, EThemeType, RowCommonParser } from 'chipmunk.client.toolkit';

export class TimestampRowParser extends RowCommonParser {

    private _parser: (str: string) => string;

    constructor(parser: (str: string) => string) {
        super();
        this._parser = parser;
    }

    public parse(str: string, themeTypeRef: EThemeType, row: IRowInfo): string | Modifier {
        return this._parser(str);
    }

}
