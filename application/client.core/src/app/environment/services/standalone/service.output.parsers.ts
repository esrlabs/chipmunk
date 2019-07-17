import * as Toolkit from 'logviewer.client.toolkit';
import { Observable, Subject } from 'rxjs';
import { ComponentFactory, ModuleWithComponentFactories } from '@angular/core';
import { shadeColor, scheme_color_4, scheme_color_0 } from '../../theme/colors';
import { CColors } from '../../conts/colors';
import { getContrastColor } from '../../theme/colors';

export type TParser = (str: string, themeTypeRef?: Toolkit.EThemeType) => string;

export interface ICommonParsers {
    row: TParser[];
    rest: TParser[];
}

export type TTypeHandler = (sourceName: string) => boolean;

export interface ITypedCustomRowComponent {
    isTypeMatch: TTypeHandler;
    type: string;   // TODO: enum
    api: any;       // TODO: dynamic type like ICustomAPI<Type>
}

export interface IPluginParsers {
    row: TParser | undefined;
    rest: TParser | undefined;
}

export interface IRequest {
    reg: RegExp;
    color: string | undefined;
    background: string | undefined;
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
    private _search: Map<string, IRequest[]> = new Map();
    private _highlights: Map<string, IRequest[]> = new Map();
    private _typedRowRenders: Map<string, Toolkit.ATypedRowRender<any>> = new Map();
    private _typedRowRendersHistory: {
        sources: string[],
        aliases: Map<string, string>,
    } = {
        sources: [],
        aliases: new Map(),
    };
    private _subjects: {
        onUpdatedSearch: Subject<void>,
        onRepain: Subject<void>,
    } = {
        onUpdatedSearch: new Subject<void>(),
        onRepain: new Subject<void>(),
    };

    public getObservable(): {
        onUpdatedSearch: Observable<void>,
        onRepain: Observable<void>,
    } {
        return {
            onUpdatedSearch: this._subjects.onUpdatedSearch.asObservable(),
            onRepain: this._subjects.onRepain.asObservable(),
        };
    }

    public setParsers(module: any, pluginId: number, mwcf?: ModuleWithComponentFactories<any>) {
        if (typeof module !== 'object' || module === null) {
            return new Error(this._logger.warn(`Fail to setup parser because module isn't an object.`));
        }
        // Check plugin's parsers
        this._setPluginParsers(module, pluginId);
        // Check common
        this._setCommonParsers(module);
        // Check row components
        this._setTypedRowExternalComponent(module, mwcf);
        // Check custom row renders
        this._setTypedCustomRowRender(module);
    }

    public setSearchResults(sessionId: string, requests: IRequest[] ) {
        this._search.set(sessionId, requests);
        this._subjects.onUpdatedSearch.next();
    }

    public unsetSearchResults(sessionId: string) {
        this._search.delete(sessionId);
        this._subjects.onUpdatedSearch.next();
    }

    public setHighlights(sessionId: string, requests: IRequest[]) {
        this._highlights.set(sessionId, requests);
    }

    public getTypedRowRender(sourceName: string): Toolkit.ATypedRowRender<any> | undefined {
        return this._getTypedRowRenderBySource(sourceName);
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

    public matches(sessionId: string, row: number, str: string): { str: string, color?: string, background?: string } {
        const requests: IRequest[] | undefined = this._search.get(sessionId);
        const highlights: IRequest[] = this._highlights.get(sessionId);
        if (requests === undefined && this._highlights === undefined) {
            return {
                str: str,
            };
        }
        let first: IRequest | undefined;
        const applied: string[] = [];
        if (highlights instanceof Array) {
            highlights.forEach((request: IRequest) => {
                const bgcl: string = request.background === CColors[0] ? scheme_color_4 : (request.background === undefined ? scheme_color_4 : shadeColor(request.background, 30));
                const fgcl: string = getContrastColor(bgcl, true);
                str = str.replace(request.reg, (match: string) => {
                    if (first === undefined) {
                        first = request;
                    }
                    return `<span class="noreset match" style="background: ${bgcl}; color: ${fgcl};">${match}</span>`;
                });
                applied.push(request.reg.source);
            });
        }
        if (requests instanceof Array) {
            requests.forEach((request: IRequest) => {
                if (applied.indexOf(request.reg.source) !== -1) {
                    return;
                }
                str = str.replace(request.reg, (match: string) => {
                    if (first === undefined) {
                        first = request;
                    }
                    return `<span class="noreset match">${match}</span>`;
                });
            });
        }
        return {
            str: str,
            color: first === undefined ? undefined : first.color,
            background: first === undefined ? undefined : first.background
        };
    }

    public updateRowsView() {
        this._subjects.onRepain.next();
    }

    public _setPluginParsers(parsers: { [key: string]: TParser }, pluginId: number): boolean {
        if (pluginId === undefined) {
            return;
        }
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

    private _setCommonParsers(module: { [key: string]: TParser }) {
        Object.keys(CommonParsersNamesMap).forEach((key: string) => {
            if (typeof module[key] === 'function') {
                this._common[CommonParsersNamesMap[key]].push(module[key]);
            }
        });
    }

    private _setTypedRowExternalComponent(module: any, mwcf: ModuleWithComponentFactories<any>) {
        if (mwcf === undefined) {
            return;
        }
        const render: Toolkit.ATypedRowRender<Toolkit.ATypedRowRenderAPIExternal> = this._getTypedRowRender(module);
        if (render === undefined) {
            return;
        }
        if (render.getType() !== Toolkit.ETypedRowRenders.external) {
            return;
        }
        if (!(render.getAPI() instanceof Toolkit.ATypedRowRenderAPIExternal)) {
            this._logger.error(`Fail to set external render for row, because plugin doesn't have API<ATypedRowRenderAPIExternal> `);
            return;
        }
        const selector: string = render.getAPI().getSelector();
        // Try to find component factory
        const factory: ComponentFactory<any> | undefined = mwcf.componentFactories.find(e => e.selector === selector);
        if (factory === undefined) {
            this._logger.warn(`Fail to find factory by selector "${selector}"`);
            return;
        }
        render.getAPI().setFactory(factory);
        this._typedRowRenders.set(Toolkit.guid(), render);
    }

    private _setTypedCustomRowRender(module: { [key: string]: ITypedCustomRowComponent }) {
        const render: Toolkit.ATypedRowRender<Toolkit.ATypedRowRenderAPIColumns> = this._getTypedRowRender(module);
        if (render === undefined) {
            return;
        }
        if (render.getType() === Toolkit.ETypedRowRenders.external) {
            return;
        }
        const CTypedRowAPITable = {
            [Toolkit.ETypedRowRenders.columns]: Toolkit.ATypedRowRenderAPIColumns,
        };
        if (CTypedRowAPITable[render.getType()] === undefined) {
            this._logger.error(`Fail to find expected class for typed row render.`);
            return;
        }
        if (!(render.getAPI() instanceof CTypedRowAPITable[render.getType()])) {
            this._logger.error(`Fail to set external render for row, because plugin doesn't have API<${CTypedRowAPITable[render.getType()].name}> `);
            return;
        }
        this._typedRowRenders.set(Toolkit.guid(), render);
    }

    private _getTypedRowRender(module: any): Toolkit.ATypedRowRender<any> | undefined {
        let render: Toolkit.ATypedRowRender<any> | undefined;
        Object.keys(module).forEach((key: string) => {
            if (module[key] instanceof Toolkit.ATypedRowRender) {
                render = module[key];
            }
        });
        return render;
    }

    private _getTypedRowRenderBySource(sourceName: string): Toolkit.ATypedRowRender<any> | undefined {
        if (this._typedRowRendersHistory.sources.indexOf(sourceName) !== -1) {
            const storedGuid: string | undefined = this._typedRowRendersHistory.aliases.get(sourceName);
            if (storedGuid === undefined) {
                return undefined;
            }
            return this._typedRowRenders.get(storedGuid);
        }
        this._typedRowRendersHistory.sources.push(sourceName);
        let guid: string | undefined;
        this._typedRowRenders.forEach((typedRowComponent: any, alias: string) => {
            if (typedRowComponent.isTypeMatch(sourceName)) {
                guid = alias;
            }
        });
        if (guid === undefined) {
            return undefined;
        }
        this._typedRowRendersHistory.aliases.set(sourceName, guid);
        return this._typedRowRenders.get(guid);
    }

}

export default (new OutputParsersService());
