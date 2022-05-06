import { Subject, Subscription } from '@platform/env/subscription';
import { Events } from './events';
import { Instance as Logger } from '@platform/env/logger';
import { Row } from '@schema/content/row';

import * as Declarations from './declarations';

export { Declarations };

export type Handler<T> = (event: T) => void;
export type Subscriber<T> = (handler: Handler<T>) => Subscription;

export class Channel {
    public readonly system: {
        init: (handler: Handler<void>) => Subscription;
        ready: (handler: Handler<void>) => Subscription;
    };
    public readonly backend: {
        state: (handler: Handler<Declarations.BackendStateEvent>) => Subscription;
        job: (handler: Handler<Declarations.JobEvent>) => Subscription;
    };
    public readonly session: {
        close: (handler: Handler<string>) => Subscription;
        open: (handler: Handler<string>) => Subscription;
        change: (handler: Handler<string | undefined>) => Subscription;
        stream: {
            updated: (handler: Handler<Declarations.Stream.Updated.Event>) => Subscription;
        };
        search: {
            updated: (handler: Handler<Declarations.Search.Updated.Event>) => Subscription;
        };
    };
    public readonly ux: {
        hotkey: (handler: Handler<Declarations.HotkeyEvent>) => Subscription;
    };
    public readonly ui: {
        contextmenu: {
            open: (handler: Handler<Declarations.IMenu>) => Subscription;
            close: (handler: Handler<void>) => Subscription;
        };
        popup: {
            open: (handler: Handler<Declarations.IPopup>) => Subscription;
            close: (handler: Handler<string>) => Subscription;
        };
        toolbar: {
            min: (handler: Handler<void>) => Subscription;
            max: (handler: Handler<void>) => Subscription;
            view: (handler: Handler<Declarations.AvailableToolbarTabs>) => Subscription;
        };
        sidebar: {
            min: (handler: Handler<void>) => Subscription;
            max: (handler: Handler<void>) => Subscription;
            view: (handler: Handler<Declarations.AvailableSidebarTabs>) => Subscription;
        };
        window: {
            resize: (handler: Handler<void>) => Subscription;
        };
        layout: {
            resize: (handler: Handler<void>) => Subscription;
        };
        row: {
            hover: (handler: Handler<Row | undefined>) => Subscription;
            rank: (handler: Handler<Declarations.UI.Rank>) => Subscription;
        };
    };
    private readonly _events: Events;
    private readonly _owner: string;
    private readonly _logger: Logger;

    private _subscriptions: Subscription[] = [];

    constructor(owner: string, events: Events, logger: Logger) {
        this._owner = owner;
        this._events = events;
        this._logger = logger;
        this.system = {
            init: this._add<void>(this._events.system.init),
            ready: this._add<void>(this._events.system.ready),
        };
        this.backend = {
            state: this._add<Declarations.BackendStateEvent>(this._events.backend.state),
            job: this._add<Declarations.JobEvent>(this._events.backend.job),
        };
        this.session = {
            close: this._add<string>(this._events.session.close),
            open: this._add<string>(this._events.session.open),
            change: this._add<string | undefined>(this._events.session.change),
            stream: {
                updated: this._add<Declarations.Stream.Updated.Event>(
                    this._events.session.stream.updated,
                ),
            },
            search: {
                updated: this._add<Declarations.Search.Updated.Event>(
                    this._events.session.search.updated,
                ),
            },
        };
        this.ux = {
            hotkey: this._add<Declarations.HotkeyEvent>(this._events.ux.hotkey),
        };
        this.ui = {
            contextmenu: {
                open: this._add<Declarations.IMenu>(this._events.ui.contextmenu.open),
                close: this._add<void>(this._events.ui.contextmenu.close),
            },
            popup: {
                open: this._add<Declarations.IPopup>(this._events.ui.popup.open),
                close: this._add<string>(this._events.ui.popup.close),
            },
            toolbar: {
                min: this._add<void>(this._events.ui.toolbar.min),
                max: this._add<void>(this._events.ui.toolbar.max),
                view: this._add<Declarations.AvailableToolbarTabs>(this._events.ui.toolbar.view),
            },
            sidebar: {
                min: this._add<void>(this._events.ui.sidebar.min),
                max: this._add<void>(this._events.ui.sidebar.max),
                view: this._add<Declarations.AvailableSidebarTabs>(this._events.ui.sidebar.view),
            },
            window: {
                resize: this._add<void>(this._events.ui.window.resize),
            },
            layout: {
                resize: this._add<void>(this._events.ui.layout.resize),
            },
            row: {
                hover: this._add<Row | undefined>(this._events.ui.row.hover),
                rank: this._add<Declarations.UI.Rank>(this._events.ui.row.rank),
            },
        };
    }

    public destroy() {
        this._subscriptions.forEach((subscription) => {
            subscription.destroy();
        });
        this._logger.verbose(`All subscription has beed destroyed`);
    }

    private _add<T>(subject: Subject<T>): Subscriber<T> {
        const subscriptions = this._subscriptions;
        return function (handler: Handler<T>): Subscription {
            const subscription = subject.subscribe(handler);
            subscriptions.push(subscription);
            return subscription;
        };
    }
}
