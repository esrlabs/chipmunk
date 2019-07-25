// tslint:disable:object-literal-sort-keys
import * as Toolkit from 'logviewer.client.toolkit';

export class ParserExample extends Toolkit.ASelectionParser {

    public parse(str: string, themeTypeRef: Toolkit.EThemeType): string {
        return '_'.repeat(str.length);
    }

    public getParserName(str: string): string | undefined {
        return str.length > 100 ? undefined : `Connvert ${str.length} chars`;
    }

}
