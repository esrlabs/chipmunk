import * as Toolkit from 'logviewer.client.toolkit';
import { Observable, Subject } from 'rxjs';
import { ComponentFactory, ModuleWithComponentFactories } from '@angular/core';
import { shadeColor, scheme_color_4, scheme_color_0 } from '../../theme/colors';
import { CColors } from '../../conts/colors';
import { getContrastColor } from '../../theme/colors';

export interface IRequest {
    reg: RegExp;
    color: string | undefined;
    background: string | undefined;
}

export interface IRow {
    str: string;
    pluginId?: number;
    source?: string;
    position?: number;
    match?: boolean;
}

export class OutputParsersService {

    private _logger: Toolkit.Logger = new Toolkit.Logger('OutputParsersService');
    private _parsers: {
        bound: Map<number, Toolkit.ARowBoundParser>,
        common: Map<number, Toolkit.ARowCommonParser>,
        typed: Map<number, Toolkit.ARowTypedParser>,
    } = {
        bound: new Map(),
        common: new Map(),
        typed: new Map(),
    };
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

    public setParsers(exports: Toolkit.IPluginExports, pluginId: number, mwcf?: ModuleWithComponentFactories<any>) {
        if (typeof exports !== 'object' || exports === null) {
            return new Error(this._logger.warn(`Fail to setup parser because module isn't an object.`));
        }
        // Check plugin's parsers
        this._setBoundParsers(exports, pluginId);
        // Check common
        this._setCommonParsers(exports, pluginId);
        // Check typed parsers
        this._setTypedParsers(exports, pluginId);
        // Check row components
        this._setTypedRowExternalComponent(exports, mwcf);
        // Check custom row renders
        this._setTypedCustomRowRender(exports);
    }

    public setSearchResults(sessionId: string, requests: IRequest[] ) {
        this._search.set(sessionId, requests.map((request: IRequest) => {
            return {
                reg: new RegExp(this.serialize(request.reg.source), request.reg.flags),
                color: request.color,
                background: request.background,
            };
        }));
        this._subjects.onUpdatedSearch.next();
    }

    public unsetSearchResults(sessionId: string) {
        this._search.delete(sessionId);
        this._subjects.onUpdatedSearch.next();
    }

    public setHighlights(sessionId: string, requests: IRequest[]) {
        this._highlights.set(sessionId, requests.map((request: IRequest) => {
            return {
                reg: new RegExp(this.serialize(request.reg.source), request.reg.flags),
                color: request.color,
                background: request.background,
            };
        }));
    }

    public getTypedRowRender(sourceName: string): Toolkit.ATypedRowRender<any> | undefined {
        return this._getTypedRowRenderBySource(sourceName);
    }

    public row(row: IRow): string {
        const rowInfo: Toolkit.IRowInfo = {
            sourceName: row.source,
            position: row.position,
            match: row.match,
        };
        // Apply bound parsers
        const bound: Toolkit.ARowBoundParser | undefined = this._parsers.bound.get(row.pluginId);
        if (bound !== undefined) {
            row.str = bound.parse(row.str, Toolkit.EThemeType.dark, rowInfo);
        }
        // Apply typed parser
        this._parsers.typed.forEach((typed: Toolkit.ARowTypedParser) => {
            if (typed.isTypeMatch(row.source)) {
                row.str = typed.parse(row.str, Toolkit.EThemeType.dark, rowInfo);
            }
        });
        // Apply common parser
        this._parsers.common.forEach((common: Toolkit.ARowCommonParser) => {
            row.str = common.parse(row.str, Toolkit.EThemeType.dark, rowInfo);
        });
        return row.str;
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
            color: first === undefined ? undefined : (first.color === CColors[0] ? undefined : first.color),
            background: first === undefined ? undefined : (first.background === CColors[0] ? undefined : first.background)
        };
    }

    public escapeHTML(html: string): string {
        return html.replace(/<.*?>/gi, '');
    }

    public updateRowsView() {
        this._subjects.onRepain.next();
    }

    public serialize(str: string): string {
        // Serialize input string to prevent brocken HTML
        return str.replace(/</gi, '&lt;').replace(/>/gi, '&gt;');
    }

    public _setBoundParsers(exports: Toolkit.IPluginExports, pluginId: number): boolean {
        if (pluginId === undefined || this._parsers.bound.has(pluginId)) {
            return false;
        }
        const parser: Toolkit.ARowBoundParser | undefined = this._findExportEntity(exports, Toolkit.ARowBoundParser);
        if (parser === undefined) {
            return false;
        }
        this._parsers.bound.set(pluginId, parser);
        return true;
    }

    private _setCommonParsers(exports: Toolkit.IPluginExports, pluginId: number) {
        if (pluginId === undefined || this._parsers.common.has(pluginId)) {
            return false;
        }
        const parser: Toolkit.ARowCommonParser | undefined = this._findExportEntity(exports, Toolkit.ARowCommonParser);
        if (parser === undefined) {
            return false;
        }
        this._parsers.common.set(pluginId, parser);
        return true;
    }

    private _setTypedParsers(exports: Toolkit.IPluginExports, pluginId: number) {
        if (pluginId === undefined || this._parsers.typed.has(pluginId)) {
            return false;
        }
        const parser: Toolkit.ARowTypedParser | undefined = this._findExportEntity(exports, Toolkit.ARowTypedParser);
        if (parser === undefined) {
            return false;
        }
        this._parsers.typed.set(pluginId, parser);
        return true;
    }

    private _findExportEntity(exports: Toolkit.IPluginExports, classDef: any): any {
        let result: Toolkit.TPluginExportEntity | undefined;
        Object.keys(exports).forEach((key: string) => {
            const entity: Toolkit.TPluginExportEntity = exports[key];
            if (result !== undefined) {
                return;
            }
            if ((typeof classDef.isInstance === 'function' && classDef.isInstance(entity)) || entity instanceof classDef) {
                result = entity;
            }
        });
        return result;
    }

    private _setTypedRowExternalComponent(exports: Toolkit.IPluginExports, mwcf: ModuleWithComponentFactories<any>) {
        if (mwcf === undefined) {
            return;
        }
        const render: Toolkit.ATypedRowRender<Toolkit.ATypedRowRenderAPIExternal> = this._getTypedRowRender(exports);
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

    private _setTypedCustomRowRender(exports: Toolkit.IPluginExports) {
        const render: Toolkit.ATypedRowRender<Toolkit.ATypedRowRenderAPIColumns> = this._getTypedRowRender(exports);
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

    private _getTypedRowRender(exports: Toolkit.IPluginExports): Toolkit.ATypedRowRender<any> | undefined {
        let render: Toolkit.ATypedRowRender<any> | undefined;
        Object.keys(exports).forEach((key: string) => {
            if (exports[key] instanceof Toolkit.ATypedRowRender) {
                render = exports[key] as Toolkit.ATypedRowRender<any>;
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
