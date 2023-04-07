import { Subject, Subscription } from '@platform/env/subscription';
import { Events } from './events';
import { Logger } from '@platform/log';
import { Row } from '@schema/content/row';
import { Base } from '../session/base';
import { Session } from '../session/session';

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
        closed: (handler: Handler<string>) => Subscription;
        open: (handler: Handler<Base>) => Subscription;
        created: (handler: Handler<Session>) => Subscription;
        change: (handler: Handler<string | undefined>) => Subscription;
        closing: (handler: Handler<Base>) => Subscription;
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
            open: (handler: Handler<Declarations.Popup>) => Subscription;
            close: (handler: Handler<string>) => Subscription;
            updated: (handler: Handler<number>) => Subscription;
        };
        toolbar: {
            min: (handler: Handler<void>) => Subscription;
            max: (handler: Handler<void>) => Subscription;
            occupy: (handler: Handler<void>) => Subscription;
            state: (
                handler: Handler<
                    (state: { min: boolean; max: boolean; occupied: boolean; size: number }) => void
                >,
            ) => Subscription;
            resize: (handler: Handler<void>) => Subscription;
            view: (handler: Handler<Declarations.AvailableToolbarTabs>) => Subscription;
        };
        sidebar: {
            min: (handler: Handler<void>) => Subscription;
            max: (handler: Handler<void>) => Subscription;
            resize: (handler: Handler<void>) => Subscription;
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
        };
        input: {
            focused: (handler: Handler<void>) => Subscription;
            blur: (handler: Handler<void>) => Subscription;
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
            closed: this._add<string>(this._events.session.closed),
            open: this._add<Base>(this._events.session.open),
            created: this._add<Session>(this._events.session.created),
            change: this._add<string | undefined>(this._events.session.change),
            closing: this._add<Base>(this._events.session.closing),
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
                open: this._add<Declarations.Popup>(this._events.ui.popup.open),
                close: this._add<string>(this._events.ui.popup.close),
                updated: this._add<number>(this._events.ui.popup.updated),
            },
            toolbar: {
                min: this._add<void>(this._events.ui.toolbar.min),
                max: this._add<void>(this._events.ui.toolbar.max),
                occupy: this._add<void>(this._events.ui.toolbar.occupy),
                state: this._add<
                    (state: { min: boolean; max: boolean; occupied: boolean; size: number }) => void
                >(this._events.ui.toolbar.state),
                resize: this._add<void>(this._events.ui.toolbar.resize),
                view: this._add<Declarations.AvailableToolbarTabs>(this._events.ui.toolbar.view),
            },
            sidebar: {
                min: this._add<void>(this._events.ui.sidebar.min),
                max: this._add<void>(this._events.ui.sidebar.max),
                resize: this._add<void>(this._events.ui.sidebar.resize),
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
            },
            input: {
                focused: this._add<void>(this._events.ui.input.focused),
                blur: this._add<void>(this._events.ui.input.blur),
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
