import * as Toolkit from 'logviewer.client.toolkit';
import { IComponentDesc } from 'logviewer-client-containers';
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

export interface ITypedRowComponentDesc {
    isTypeMatch: TTypeHandler;
    component: {
        selector: string;
        inputs: { [key: string]: any }
    };
}

export interface ITypedRowComponent {
    isTypeMatch: TTypeHandler;
    component: IComponentDesc;
}

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
    private _typed: Map<string, ITypedRowComponent> = new Map();
    private _custom: Map<string, ITypedCustomRowComponent> = new Map();
    private _plugins: Map<number, IPluginParsers> = new Map();
    private _search: Map<string, IRequest[]> = new Map();
    private _highlights: Map<string, IRequest[]> = new Map();
    private _history: {
        typedComSources: string[],
        typedComAliases: Map<string, string>,
        typedCustSources: string[],
        typedCustAliases: Map<string, string>
    } = {
        typedComSources: [],
        typedComAliases: new Map(),
        typedCustSources: [],
        typedCustAliases: new Map(),
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
        this._setTypedRowComponent(module, mwcf);
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

    public getRowComponent(sourceName: string): IComponentDesc | undefined {
        const component: ITypedRowComponent | undefined = this._getTypedComponent(sourceName);
        return component === undefined ? undefined : component.component;
    }

    public getCustomRowRender(sourceName: string): ITypedCustomRowComponent | undefined {
        return this._getTypedCustomComponent(sourceName);
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

    private _setTypedRowComponent(module: { [key: string]: ITypedRowComponentDesc }, mwcf: ModuleWithComponentFactories<any>) {
        if (mwcf === undefined) {
            return;
        }
        if (typeof module[Toolkit.EParsers.typedRowComponent] !== 'object' || module[Toolkit.EParsers.typedRowComponent] === null) {
            return;
        }
        if (typeof module[Toolkit.EParsers.typedRowComponent].isTypeMatch !== 'function') {
            return;
        }
        if (typeof module[Toolkit.EParsers.typedRowComponent].component !== 'object' || module[Toolkit.EParsers.typedRowComponent].component === null) {
            return;
        }
        if (typeof module[Toolkit.EParsers.typedRowComponent].component.selector !== 'string') {
            return;
        }
        const selector: string = module[Toolkit.EParsers.typedRowComponent].component.selector;
        // Try to find component factory
        const factory: ComponentFactory<any> | undefined = mwcf.componentFactories.find(e => e.selector === selector);
        if (factory === undefined) {
            this._logger.warn(`Fail to find factory by selector "${selector}"`);
            return;
        }
        const guid: string = Toolkit.guid();
        this._typed.set(guid, {
            isTypeMatch: module[Toolkit.EParsers.typedRowComponent].isTypeMatch,
            component: {
                factory: factory,
                inputs: module[Toolkit.EParsers.typedRowComponent].component.inputs,
                resolved: true,
            },
        });
    }

    private _setTypedCustomRowRender(module: { [key: string]: ITypedCustomRowComponent }) {
        if (typeof module[Toolkit.EParsers.customTypedRowRender] !== 'object' || module[Toolkit.EParsers.customTypedRowRender] === null) {
            return;
        }
        if (typeof module[Toolkit.EParsers.customTypedRowRender].isTypeMatch !== 'function') {
            return;
        }
        if (typeof module[Toolkit.EParsers.customTypedRowRender].type !== 'string') {
            return;
        }
        if (typeof module[Toolkit.EParsers.customTypedRowRender].api !== 'object' || module[Toolkit.EParsers.customTypedRowRender].api === null) {
            return;
        }
        const guid: string = Toolkit.guid();
        this._custom.set(guid, {
            isTypeMatch: module[Toolkit.EParsers.customTypedRowRender].isTypeMatch,
            type: module[Toolkit.EParsers.customTypedRowRender].type,
            api: module[Toolkit.EParsers.customTypedRowRender].api,
        });
    }

    private _getTypedComponent(sourceName: string): ITypedRowComponent | undefined {
        const isSrcInHistory: boolean = this._history.typedComSources.indexOf(sourceName) !== -1;
        if (isSrcInHistory) {
            const storedGuid: string | undefined = this._history.typedComAliases.get(sourceName);
            if (storedGuid === undefined) {
                return undefined;
            }
            return this._typed.get(storedGuid);
        }
        this._history.typedComSources.push(sourceName);
        let guid: string | undefined;
        this._typed.forEach((typedRowComponent: ITypedRowComponent, alias: string) => {
            if (typedRowComponent.isTypeMatch(sourceName)) {
                guid = alias;
            }
        });
        if (guid === undefined) {
            return undefined;
        }
        this._history.typedComAliases.set(sourceName, guid);
        return this._typed.get(guid);
    }

    private _getTypedCustomComponent(sourceName: string): ITypedCustomRowComponent | undefined {
        const isSrcInHistory: boolean = this._history.typedCustSources.indexOf(sourceName) !== -1;
        if (isSrcInHistory) {
            const storedGuid: string | undefined = this._history.typedCustAliases.get(sourceName);
            if (storedGuid === undefined) {
                return undefined;
            }
            return this._custom.get(storedGuid);
        }
        this._history.typedCustSources.push(sourceName);
        let guid: string | undefined;
        this._custom.forEach((typedRowComponent: ITypedCustomRowComponent, alias: string) => {
            if (typedRowComponent.isTypeMatch(sourceName)) {
                guid = alias;
            }
        });
        if (guid === undefined) {
            return undefined;
        }
        this._history.typedCustAliases.set(sourceName, guid);
        return this._custom.get(guid);
    }

}

export default (new OutputParsersService());
