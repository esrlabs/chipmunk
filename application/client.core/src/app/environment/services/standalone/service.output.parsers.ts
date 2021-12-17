import * as Toolkit from 'chipmunk.client.toolkit';

import { Observable, Subject } from 'rxjs';
import { ComponentFactory, ModuleWithComponentFactories } from '@angular/core';
import { getContrastColor } from '../../theme/colors';
import { CColors } from '../../conts/colors';
import { FilterRequest } from '../../controller/session/dependencies/search/dependencies/filters/controller.session.tab.search.filters.request';
import { Session } from '../../controller/session/session';
import { Subscription } from 'rxjs';
import { EKey, EParent } from '../../services/standalone/service.output.redirections';
import { IRequest, Modifier } from 'chipmunk.client.toolkit';

import { ModifierProcessor } from './row.modifiers/modifiers.processor';
import { HighlightsModifier } from './row.modifiers/row.modifier.highlights';
import { FiltersModifier } from './row.modifiers/row.modifier.filters';

import EventsSessionService from '../../services/standalone/service.events.session';
import OutputRedirectionsService from '../../services/standalone/service.output.redirections';

export interface IRow {
    str: string;
    pluginId?: number;
    source?: string;
    position?: number;
    hasOwnStyles?: boolean;
}

export interface IHighlight {
    color: string | undefined;
    background: string | undefined;
}

export interface ITooltip {
    id: string;
    getContent(str: string, position: number, selection: string): Promise<string | undefined>;
}

interface ICachedKey {
    key: string;
    regExp: RegExp;
}

export type TClickHandler = (str: string, position: number, key?: EKey) => void;

export class OutputParsersService {
    readonly TOOLTIP_ATTR_NAME: string = 'data-row-tooltip';
    readonly CLICK_HANDLER_ATTR_NAME: string = 'data-row-click-handler';
    readonly PLACEHOLDER_OPEN = '\u000A';
    readonly PLACEHOLDER_CLOSE = '\u000B';

    private _logger: Toolkit.Logger = new Toolkit.Logger('OutputParsersService');
    private _parsers: {
        bound: Map<number, Toolkit.ARowBoundParser>;
        common: Map<number, Toolkit.ARowCommonParser>;
        typed: Map<number, Toolkit.ARowTypedParser>;
        session: Map<string, Map<string, Toolkit.ARowCommonParser>>;
        tooltips: Map<string, Map<string, ITooltip>>;
        clicks: Map<string, Map<string, TClickHandler>>;
    } = {
        bound: new Map(),
        common: new Map(),
        typed: new Map(),
        session: new Map(),
        tooltips: new Map(),
        clicks: new Map(),
    };
    private _search: Map<string, IRequest[]> = new Map();
    private _charts: Map<string, IRequest[]> = new Map();
    private _highlights: Map<string, IRequest[]> = new Map();
    private _typedRowRenders: Map<string, Toolkit.ATypedRowRender<any>> = new Map();
    private _subscriptions: { [key: string]: Subscription } = {};
    private _sessionSubscriptions: { [key: string]: Subscription } = {};
    private _controller: Session | undefined;
    private _sequence: number = 0;
    private _typedRowRendersHistory: {
        sources: string[];
        aliases: Map<string, string>;
    } = {
        sources: [],
        aliases: new Map(),
    };
    private _subjects: {
        onUpdatedSearch: Subject<void>;
        onRepain: Subject<void>;
    } = {
        onUpdatedSearch: new Subject<void>(),
        onRepain: new Subject<void>(),
    };
    private _cache: { [key: string]: ICachedKey } = {};

    constructor() {
        this._subscriptions.onSessionChange =
            EventsSessionService.getObservable().onSessionChange.subscribe(
                this._onSessionChange.bind(this),
            );
        this._subscriptions.onSessionClosed =
            EventsSessionService.getObservable().onSessionClosed.subscribe(
                this._onSessionClosed.bind(this),
            );
    }

    public destroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public getObservable(): {
        onUpdatedSearch: Observable<void>;
        onRepain: Observable<void>;
    } {
        return {
            onUpdatedSearch: this._subjects.onUpdatedSearch.asObservable(),
            onRepain: this._subjects.onRepain.asObservable(),
        };
    }

    public setParsers(
        exports: Toolkit.IPluginExports,
        pluginId: number,
        mwcf?: ModuleWithComponentFactories<any>,
    ): Error | undefined {
        if (typeof exports !== 'object' || exports === null) {
            return new Error(
                this._logger.warn(`Fail to setup parser because module isn't an object.`),
            );
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
        return undefined;
    }

    public setSearchResults(sessionId: string, requests: FilterRequest[]) {
        this._search.set(
            sessionId,
            requests.map((request: FilterRequest) => {
                return {
                    reg: request.asRegExp(),
                    color: request.getColor(),
                    background: request.getBackground(),
                };
            }),
        );
        this._subjects.onUpdatedSearch.next();
    }

    public setHighlights(sessionId: string, requests: FilterRequest[]) {
        this._highlights.set(
            sessionId,
            requests.map((request: FilterRequest) => {
                return {
                    reg: request.asRegExp(),
                    color: request.getColor(),
                    background: request.getBackground(),
                    active: request.getState(),
                };
            }),
        );
    }

    public setCharts(sessionId: string, requests: IRequest[]) {
        this._charts.set(
            sessionId,
            requests.map((request: IRequest) => {
                return {
                    reg: new RegExp(this.serialize(request.reg.source), request.reg.flags),
                    color:
                        request.color !== undefined
                            ? getContrastColor(request.color, true)
                            : undefined,
                    background: request.color,
                };
            }),
        );
    }

    public unsetSearchResults(sessionId: string) {
        this._search.delete(sessionId);
        this._subjects.onUpdatedSearch.next();
    }

    public unsetChartsResults(sessionId: string) {
        this._charts.delete(sessionId);
    }

    public getTypedRowRender(
        sourceName: string,
        sourceMeta?: string,
    ): Toolkit.ATypedRowRender<any> | undefined {
        return this._getTypedRowRenderBySource(sourceName, sourceMeta);
    }

    public row(row: IRow, target: EParent, sessionId?: string): string {
        sessionId =
            sessionId !== undefined
                ? sessionId
                : this._controller === undefined
                ? undefined
                : this._controller.getGuid();
        if (sessionId === undefined) {
            this._logger.warn(`Session ID isn't defined.`);
            return '';
        }
        const rowInfo: Toolkit.IRowInfo = {
            sourceName: row.source,
            position: row.position,
            hasOwnStyles: row.hasOwnStyles,
        };
        if (this._controller === undefined) {
            this._logger.warn(`Fail to find controller.`);
            return '';
        }
        if (row.position === undefined) {
            this._logger.warn(`Unknown possition of row`);
            return '';
        }
        const modifiers: Modifier[] = [
            ...this._controller.getSessionComments().getModifiers(row.position, row.str),
        ];
        // Apply bound parsers
        const bound: Toolkit.ARowBoundParser | undefined =
            row.pluginId === undefined ? undefined : this._parsers.bound.get(row.pluginId);
        if (bound !== undefined) {
            const parsed = bound.parse(row.str, Toolkit.EThemeType.dark, rowInfo);
            if (typeof parsed === 'object') {
                modifiers.push(parsed);
            } else if (parsed !== undefined) {
                this._logger.warn(
                    `Bound parsers: using of string parsers is depricated. Please create Modifier`,
                );
            }
        }
        // Apply typed parser
        this._parsers.typed.forEach((typed: Toolkit.ARowTypedParser) => {
            if (row.source !== undefined && typed.isTypeMatch(row.source)) {
                const parsed = typed.parse(row.str, Toolkit.EThemeType.dark, rowInfo);
                if (typeof parsed === 'object') {
                    modifiers.push(parsed);
                } else if (parsed !== undefined) {
                    this._logger.warn(
                        `Typed parsers: using of string parsers is depricated. Please create Modifier`,
                    );
                }
            }
        });
        // Apply common parser
        this._parsers.common.forEach((common: Toolkit.ARowCommonParser) => {
            const parsed = common.parse(row.str, Toolkit.EThemeType.dark, rowInfo);
            if (typeof parsed === 'object') {
                modifiers.push(parsed);
            } else if (parsed !== undefined) {
                this._logger.warn(
                    `Common parsers: using of string parsers is depricated. Please create Modifier`,
                );
            }
        });
        // Apply session parsers
        const parsers: Map<string, Toolkit.ARowCommonParser> | undefined =
            this._parsers.session.get(this._controller.getGuid());
        if (parsers !== undefined) {
            parsers.forEach((parser: Toolkit.ARowCommonParser) => {
                const parsed = parser.parse(row.str, Toolkit.EThemeType.dark, rowInfo);
                if (typeof parsed === 'object') {
                    modifiers.push(parsed);
                } else if (parsed !== undefined) {
                    this._logger.warn(
                        `Common session parsers: using of string parsers is depricated. Please create Modifier`,
                    );
                }
            });
        }
        const requests: IRequest[] | undefined = this._search.get(sessionId);
        const highlights: IRequest[] | undefined = this._highlights.get(sessionId);
        const charts: IRequest[] | undefined = this._charts.get(sessionId);
        modifiers.push(
            new HighlightsModifier(
                [
                    ...(highlights === undefined ? [] : highlights),
                    ...(charts === undefined ? [] : charts),
                ],
                row.str,
            ),
        );
        modifiers.push(new FiltersModifier(requests instanceof Array ? requests : [], row.str));
        const processor = new ModifierProcessor(
            modifiers,
            row.hasOwnStyles === undefined ? false : row.hasOwnStyles,
        );
        return processor.parse(row.str, target);
    }

    public highlight(sessionId: string, str: string, parent: EParent): IHighlight {
        const single: boolean = (() => {
            if (this._controller === undefined) {
                return false;
            }
            return this._controller.getSessionSearch().getFiltersAPI().isSingle();
        })();
        if (single || this._controller === undefined) {
            return {
                color: undefined,
                background: undefined,
            };
        }
        const requests: IRequest[] = this._search.has(sessionId)
            ? (this._search.get(sessionId) as IRequest[])
            : [];
        let highlights: IRequest[] = [];
        if (this._highlights.has(sessionId)) {
            if (parent === EParent.search) {
                const active = this._controller
                    .getSessionSearch()
                    .getFiltersAPI()
                    .getStorage()
                    .getActive();
                highlights = (this._highlights.get(sessionId) as IRequest[]).filter(
                    (f) =>
                        active.find(
                            (a) =>
                                `${a.asRegExp().source}-${a.asRegExp().flags}` ===
                                `${f.reg.source}-${f.reg.flags}`,
                        ) !== undefined,
                );
            } else {
                highlights = this._highlights.get(sessionId) as IRequest[];
            }
        } else {
            highlights = [];
        }
        const charts: IRequest[] = this._charts.has(sessionId)
            ? (this._charts.get(sessionId) as IRequest[])
            : [];
        const target: IRequest | undefined = ([] as IRequest[])
            .concat(highlights, charts, requests)
            .find((r) => str.search(r.reg) !== -1);
        return {
            color:
                target === undefined
                    ? undefined
                    : target.color === CColors[0]
                    ? undefined
                    : target.color,
            background:
                target === undefined
                    ? undefined
                    : target.background === CColors[0]
                    ? undefined
                    : target.background,
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

    public setSessionParser(
        id: string,
        parser: Toolkit.RowCommonParser,
        session?: string,
        update: boolean = false,
    ) {
        session =
            session === undefined
                ? this._controller === undefined
                    ? undefined
                    : this._controller.getGuid()
                : session;
        if (session === undefined) {
            return;
        }
        let parsers: Map<string, Toolkit.RowCommonParser> | undefined =
            this._parsers.session.get(session);
        if (parsers === undefined) {
            parsers = new Map();
        }
        parsers.set(id, parser);
        this._parsers.session.set(session, parsers);
        if (update) {
            this.updateRowsView();
        }
    }

    public removeSessionParser(id: string, session?: string, update: boolean = false) {
        session =
            session === undefined
                ? this._controller === undefined
                    ? undefined
                    : this._controller.getGuid()
                : session;
        if (session === undefined) {
            return;
        }
        const parsers: Map<string, Toolkit.RowCommonParser> | undefined =
            this._parsers.session.get(session);
        if (parsers === undefined) {
            return;
        }
        parsers.delete(id);
        this._parsers.session.set(session, parsers);
        if (update) {
            this.updateRowsView();
        }
    }

    public setSessionTooltip(tooltip: ITooltip, session?: string) {
        session =
            session === undefined
                ? this._controller === undefined
                    ? undefined
                    : this._controller.getGuid()
                : session;
        if (session === undefined) {
            return;
        }
        let tooltips: Map<string, ITooltip> | undefined = this._parsers.tooltips.get(session);
        if (tooltips === undefined) {
            tooltips = new Map();
        }
        tooltips.set(tooltip.id, tooltip);
        this._parsers.tooltips.set(session, tooltips);
    }

    public getTooltipHook(id: string): string {
        return ` ${this.TOOLTIP_ATTR_NAME}="${id}" `;
    }

    public getTooltipContent(
        target: HTMLElement,
        str: string,
        position: number,
    ): Promise<string | undefined> {
        return new Promise((resolve, reject) => {
            if (this._controller === undefined) {
                reject(new Error(this._logger.error(`No active session controller availble`)));
                return;
            }
            const tooltips: Map<string, ITooltip> | undefined = this._parsers.tooltips.get(
                this._controller.getGuid(),
            );
            if (tooltips === undefined) {
                return resolve(undefined);
            }
            if (target === undefined || target === null) {
                return resolve(undefined);
            }
            const id: string | null | undefined = target.getAttribute(this.TOOLTIP_ATTR_NAME);
            if (id === null || id === undefined) {
                return resolve(undefined);
            }
            const tooltip: ITooltip | undefined = tooltips.get(id);
            if (tooltip === undefined) {
                return resolve(undefined);
            }
            tooltip
                .getContent(str, position, target.innerHTML)
                .then(resolve)
                .catch((err: Error) => {
                    reject(
                        new Error(
                            this._logger.warn(`Fail get tooltip value due error: ${err.message}`),
                        ),
                    );
                });
        });
    }

    public setSessionClickHandler(id: string, handler: TClickHandler, session?: string) {
        session =
            session === undefined
                ? this._controller === undefined
                    ? undefined
                    : this._controller.getGuid()
                : session;
        if (session === undefined) {
            return;
        }
        let clicks: Map<string, TClickHandler> | undefined = this._parsers.clicks.get(session);
        if (clicks === undefined) {
            clicks = new Map();
        }
        clicks.set(id, handler);
        this._parsers.clicks.set(session, clicks);
    }

    public getClickHandlerHook(id: string): string {
        return ` ${this.CLICK_HANDLER_ATTR_NAME}="${id}" `;
    }

    public emitClickHandler(target: HTMLElement, str: string, position: number): boolean {
        if (this._controller === undefined) {
            this._logger.warn(`No active session controller available`);
            return false;
        }
        const handlers: Map<string, TClickHandler> | undefined = this._parsers.clicks.get(
            this._controller.getGuid(),
        );
        if (handlers === undefined) {
            return false;
        }
        if (target === undefined || target === null) {
            return false;
        }
        const id: string | null | undefined = target.getAttribute(this.CLICK_HANDLER_ATTR_NAME);
        if (id === null || id === undefined) {
            return false;
        }
        const handler: TClickHandler | undefined = handlers.get(id);
        if (handler === undefined) {
            return false;
        }
        try {
            handler(str, position, OutputRedirectionsService.getHoldKey());
        } catch (err) {
            this._logger.warn(
                `Fail execute handler on row ${position} due error: ${
                    err instanceof Error ? err.message : err
                }`,
            );
        }
        return true;
    }

    private _setBoundParsers(exports: Toolkit.IPluginExports, pluginId: number): boolean {
        if (pluginId === undefined || this._parsers.bound.has(pluginId)) {
            return false;
        }
        const parser: Toolkit.ARowBoundParser | undefined = this._findExportEntity(
            exports,
            Toolkit.ARowBoundParser,
        );
        if (parser === undefined) {
            return false;
        }
        this._parsers.bound.set(pluginId, parser);
        return true;
    }

    private _onSessionChange(controller?: Session) {
        Object.keys(this._sessionSubscriptions).forEach((key: string) => {
            this._sessionSubscriptions[key].unsubscribe();
        });
        if (controller === undefined) {
            return;
        }
        if (!this._parsers.session.has(controller.getGuid())) {
            this._parsers.session.set(controller.getGuid(), new Map());
        }
        if (!this._parsers.tooltips.has(controller.getGuid())) {
            this._parsers.tooltips.set(controller.getGuid(), new Map());
        }
        this._controller = controller;
        this._subjects.onRepain.next();
    }

    private _onSessionClosed(guid: string) {
        this._parsers.session.delete(guid);
        this._parsers.tooltips.delete(guid);
    }

    private _setCommonParsers(exports: Toolkit.IPluginExports, pluginId: number) {
        if (pluginId === undefined || this._parsers.common.has(pluginId)) {
            return false;
        }
        const parser: Toolkit.ARowCommonParser | undefined = this._findExportEntity(
            exports,
            Toolkit.ARowCommonParser,
        );
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
        const parser: Toolkit.ARowTypedParser | undefined = this._findExportEntity(
            exports,
            Toolkit.ARowTypedParser,
        );
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
            if (
                (typeof classDef.isInstance === 'function' && classDef.isInstance(entity)) ||
                entity instanceof classDef
            ) {
                result = entity;
            }
        });
        return result;
    }

    private _setTypedRowExternalComponent(
        exports: Toolkit.IPluginExports,
        mwcf: ModuleWithComponentFactories<any> | undefined,
    ) {
        if (mwcf === undefined) {
            return;
        }
        const render: Toolkit.ATypedRowRender<Toolkit.ATypedRowRenderAPIExternal> | undefined =
            this._getTypedRowRender(exports);
        if (render === undefined) {
            return;
        }
        if (render.getType() !== Toolkit.ETypedRowRenders.external) {
            return;
        }
        if (!(render.getAPI() instanceof Toolkit.ATypedRowRenderAPIExternal)) {
            this._logger.error(
                `Fail to set external render for row, because plugin doesn't have API<ATypedRowRenderAPIExternal> `,
            );
            return;
        }
        const selector: string = render.getAPI().getSelector();
        // Try to find component factory
        const factory: ComponentFactory<any> | undefined = mwcf.componentFactories.find(
            (e) => e.selector === selector,
        );
        if (factory === undefined) {
            this._logger.warn(`Fail to find factory by selector "${selector}"`);
            return;
        }
        render.getAPI().setFactory(factory);
        this._typedRowRenders.set(Toolkit.guid(), render);
    }

    private _setTypedCustomRowRender(exports: Toolkit.IPluginExports) {
        const render: Toolkit.ATypedRowRender<Toolkit.ATypedRowRenderAPIColumns> | undefined =
            this._getTypedRowRender(exports);
        if (render === undefined) {
            return;
        }
        if (render.getType() === Toolkit.ETypedRowRenders.external) {
            return;
        }
        const CTypedRowAPITable = {
            [Toolkit.ETypedRowRenders.columns]: Toolkit.ATypedRowRenderAPIColumns,
        };
        if ((CTypedRowAPITable as any)[render.getType()] === undefined) {
            this._logger.error(`Fail to find expected class for typed row render.`);
            return;
        }
        if (!(render.getAPI() instanceof (CTypedRowAPITable as any)[render.getType()])) {
            this._logger.error(
                `Fail to set external render for row, because plugin doesn't have API<${
                    (CTypedRowAPITable as any)[render.getType()].name
                }> `,
            );
            return;
        }
        this._typedRowRenders.set(Toolkit.guid(), render);
    }

    private _getTypedRowRender(
        exports: Toolkit.IPluginExports,
    ): Toolkit.ATypedRowRender<any> | undefined {
        let render: Toolkit.ATypedRowRender<any> | undefined;
        Object.keys(exports).forEach((key: string) => {
            if (exports[key] instanceof Toolkit.ATypedRowRender) {
                render = exports[key] as Toolkit.ATypedRowRender<any>;
            }
        });
        return render;
    }

    private _getTypedRowRenderBySource(
        sourceName: string,
        sourceMeta?: string,
    ): Toolkit.ATypedRowRender<any> | undefined {
        const hash: string = sourceName + (typeof sourceMeta === 'string' ? sourceMeta : '');
        if (this._typedRowRendersHistory.sources.indexOf(hash) !== -1) {
            const storedGuid: string | undefined = this._typedRowRendersHistory.aliases.get(hash);
            if (storedGuid === undefined) {
                return undefined;
            }
            return this._typedRowRenders.get(storedGuid);
        }
        this._typedRowRendersHistory.sources.push(hash);
        let guid: string | undefined;
        this._typedRowRenders.forEach((typedRowComponent: any, alias: string) => {
            if (typedRowComponent.isTypeMatch(sourceName, sourceMeta)) {
                guid = alias;
            }
        });
        if (guid === undefined) {
            return undefined;
        }
        this._typedRowRendersHistory.aliases.set(hash, guid);
        return this._typedRowRenders.get(guid);
    }

    private _getCachedKeyForValue(value: string): ICachedKey {
        if (this._cache[value] === undefined) {
            const key: string = this.PLACEHOLDER_OPEN + this._sequence++ + this.PLACEHOLDER_CLOSE;
            this._cache[value] = {
                key: key,
                regExp: new RegExp(key, 'gi'),
            };
        }
        return this._cache[value];
    }
}

export default new OutputParsersService();
