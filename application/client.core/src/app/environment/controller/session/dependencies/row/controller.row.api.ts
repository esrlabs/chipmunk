import { Subscription } from 'rxjs';
import { IBookmark } from '../bookmarks/controller.session.tab.stream.bookmarks';
import { ControllerSessionScope, IRowNumberWidthData } from '../scope/controller.session.tab.scope';

import OutputRedirectionsService from '../../../../services/standalone/service.output.redirections';
import OutputParsersService from '../../../../services/standalone/service.output.parsers';
import ViewsEventsService from '../../../../services/standalone/service.views.events';

import { Dependency, SessionGetter } from '../session.dependency';

import * as Toolkit from 'chipmunk.client.toolkit';

export interface IRow {
    str: string | undefined;
    position: number;
    positionInStream: number;
    pluginId: number;
    sessionId: string;
    parent: string;
    api: ControllerRowAPI;
}

export interface IRowAPI {
    repain(): void;
    refresh(): void;
    setHoverPosition(row: number): void;
    setBookmark(bookmark: IBookmark): void;
    removeBookmark(index: number): void;
    resize(scope: ControllerSessionScope): void;
    setRank(rank: number): void;
}

export class ControllerRowAPI implements Dependency {
    private readonly _logger: Toolkit.Logger;
    private readonly _uuid: string;
    private readonly _subscriptions: { [key: string]: Subscription | Toolkit.Subscription } = {};
    private readonly _session: SessionGetter;
    private _rows: Map<string, IRowAPI> = new Map();

    constructor(uuid: string, getter: SessionGetter) {
        this._uuid = uuid;
        this._session = getter;
        this._logger = new Toolkit.Logger(`ControllerRowAPI (${uuid})`);
    }

    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._subscribe();
            resolve();
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            this._unsubscribe();
            resolve();
        });
    }

    public getName(): string {
        return 'ControllerRowAPI';
    }

    public register(guid: string, api: IRowAPI) {
        if (this._rows.has(guid)) {
            return;
        }
        this._rows.set(guid, api);
    }

    public unregister(guid: string) {
        this._rows.delete(guid);
    }

    public getRank(): number {
        return this._session().getStreamOutput().getRank();
    }

    private _subscribe() {
        this._subscriptions.onUpdatedSearch =
            OutputParsersService.getObservable().onUpdatedSearch.subscribe(
                this._onRepain.bind(this),
            );
        this._subscriptions.onRepain = OutputParsersService.getObservable().onRepain.subscribe(
            this._onRepain.bind(this),
        );
        this._subscriptions.onRowHover = ViewsEventsService.getObservable().onRowHover.subscribe(
            this._onRowHover.bind(this),
        );
        this._subscriptions.onRowWasSelected = OutputRedirectionsService.subscribe(
            this._uuid,
            this._onRefresh.bind(this),
        );
        this._subscriptions.onRankChanged = this._session()
            .getStreamOutput()
            .getObservable()
            .onRankChanged.subscribe(this._onRankChanged.bind(this));
        this._subscriptions.onAddedBookmark = this._session()
            .getBookmarks()
            .getObservable()
            .onAdded.subscribe(this._onAddedBookmark.bind(this));
        this._subscriptions.onRemovedBookmark = this._session()
            .getBookmarks()
            .getObservable()
            .onRemoved.subscribe(this._onRemovedBookmark.bind(this));
        const scope = this._session()
            .getScope()
            .get<IRowNumberWidthData>(ControllerSessionScope.Keys.CRowNumberWidth);
        if (scope === undefined) {
            throw new Error(
                this._logger.error(
                    `Fail get requested scope: ${ControllerSessionScope.Keys.CRowNumberWidth}`,
                ),
            );
        }
        this._subscriptions.onSizeRequested = scope.onSizeRequested
            .asObservable()
            .subscribe(this._onSizeRequested.bind(this));
    }

    public getTimestamp() {
        return this._session().getTimestamp();
    }

    public getScope() {
        return this._session().getScope();
    }

    public getStreamOutput() {
        return this._session().getStreamOutput();
    }

    public getBookmarks() {
        return this._session().getBookmarks();
    }

    private _unsubscribe() {
        this._rows.clear();
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    private _onRepain() {
        this._rows.forEach((row: IRowAPI) => {
            row.repain();
        });
    }

    private _onRefresh() {
        this._rows.forEach((row: IRowAPI) => {
            row.refresh();
        });
    }

    private _onRowHover(position: number) {
        this._rows.forEach((row: IRowAPI) => {
            row.setHoverPosition(position);
        });
    }

    private _onAddedBookmark(bookmark: IBookmark) {
        this._rows.forEach((row: IRowAPI) => {
            row.setBookmark(bookmark);
        });
    }

    private _onRemovedBookmark(index: number) {
        this._rows.forEach((row: IRowAPI) => {
            row.removeBookmark(index);
        });
    }

    private _onSizeRequested() {
        this._rows.forEach((row: IRowAPI) => {
            row.resize(this._session().getScope());
        });
    }

    private _onRankChanged(rank: number): void {
        this._rows.forEach((row: IRowAPI) => {
            row.setRank(rank);
        });
    }
}
