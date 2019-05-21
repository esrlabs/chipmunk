import * as Toolkit from 'logviewer.client.toolkit';
import { Observable, Subject } from 'rxjs';

export type TParser = (str: string, themeTypeRef?: Toolkit.EThemeType) => string;

export interface ICommonParsers {
    row: TParser[];
    rest: TParser[];
}

export interface IPluginParsers {
    row: TParser | undefined;
    rest: TParser | undefined;
}

export interface ISearchResults {
    regs: RegExp[]; // List of regs in search
}

const PluginParsersNamesMap = {
    [Toolkit.EParsers.pluginRowParser]: 'row',
    [Toolkit.EParsers.pluginRestParser]: 'rest',
};

const CommonParsersNamesMap = {
    [Toolkit.EParsers.commonRowParser]: 'row',
    [Toolkit.EParsers.commonRestParser]: 'rest',
};

export class OutputParsersService {

    private _logger: Toolkit.Logger = new Toolkit.Logger('OutputParsersService');
    private _common: ICommonParsers = {
        row: [],
        rest: [],
    };
    private _plugins: Map<number, IPluginParsers> = new Map();
    private _search: Map<string, ISearchResults> = new Map();
    private _subjects: {
        onUpdatedSearch: Subject<void>
    } = {
        onUpdatedSearch: new Subject<void>()
    };

    public getObservable(): {
        onUpdatedSearch: Observable<void>,
    } {
        return {
            onUpdatedSearch: this._subjects.onUpdatedSearch.asObservable()
        };
    }

    public setPluginParsers(pluginId: number, parsers: { [key: string]: TParser }): boolean {
        if (this._plugins.has(pluginId)) {
            return false;
        }
        const result: any = {};
        Object.keys(PluginParsersNamesMap).forEach((key: string) => {
            if (typeof parsers[key] === 'function') {
                result[PluginParsersNamesMap[key]] = parsers[key];
            }
        });
        if (Object.keys(result).length === 0) {
            return false;
        }
        this._plugins.set(pluginId, result);
        return true;
    }

    public setCommonParsers(parsers: { [key: string]: TParser }) {
        Object.keys(CommonParsersNamesMap).forEach((key: string) => {
            if (typeof parsers[key] === 'function') {
                this._common[CommonParsersNamesMap[key]].push(parsers[key]);
            }
        });
    }

    public setSearchResults(sessionId: string, regs: RegExp[] ) {
        this._search.set(sessionId, { regs: regs });
        this._subjects.onUpdatedSearch.next();
    }

    public unsetSearchResults(sessionId: string) {
        this._search.delete(sessionId);
        this._subjects.onUpdatedSearch.next();
    }

    public row(str: string, pluginId?: number): string {
        if (pluginId === undefined) {
            if (this._common.row.length === 0) {
                return str;
            }
            this._common.row.forEach((parser: TParser) => {
                str = parser(str, Toolkit.EThemeType.light);
            });
            return str;
        } else {
            const plugin: IPluginParsers | undefined = this._plugins.get(pluginId);
            if (plugin === undefined) {
                return str;
            }
            if (plugin.row === undefined) {
                return str;
            }
            return plugin.row(str, Toolkit.EThemeType.light);
        }
    }

    public rest(str: string, pluginId?: number): string {
        if (pluginId === undefined) {
            if (this._common.rest.length === 0) {
                return str;
            }
            this._common.rest.forEach((parser: TParser) => {
                str = parser(str, Toolkit.EThemeType.light);
            });
            return str;
        } else {
            const plugin: IPluginParsers | undefined = this._plugins.get(pluginId);
            if (plugin === undefined) {
                return str;
            }
            if (plugin.rest === undefined) {
                return str;
            }
            return plugin.rest(str, Toolkit.EThemeType.light);
        }
    }

    public matches(sessionId: string, row: number, str: string): string {
        const regs: ISearchResults | undefined = this._search.get(sessionId);
        if (regs === undefined) {
            return str;
        }
        regs.regs.forEach((reg: RegExp) => {
            str = str.replace(reg, (match: string) => {
                return `<span class="noreset match">${match}</span>`;
            });
        });
        return str;
    }

}

export default (new OutputParsersService());
