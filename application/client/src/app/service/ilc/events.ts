import { Subject } from '@platform/env/subscription';
import { Row } from '@schema/content/row';

import * as Declarations from './declarations';

export { Declarations };

export class Events {
    public readonly system: {
        init: Subject<void>;
        ready: Subject<void>;
    };
    public readonly backend: {
        state: Subject<Declarations.BackendStateEvent>;
        job: Subject<Declarations.JobEvent>;
    };
    public readonly session: {
        close: Subject<string>;
        open: Subject<string>;
        change: Subject<string | undefined>;
        stream: {
            updated: Subject<Declarations.Stream.Updated.Event>;
        };
        search: {
            updated: Subject<Declarations.Search.Updated.Event>;
        };
    };
    public readonly ux: {
        hotkey: Subject<Declarations.HotkeyEvent>;
    };
    public readonly ui: {
        contextmenu: {
            open: Subject<Declarations.IMenu>;
            close: Subject<void>;
        };
        popup: {
            open: Subject<Declarations.IPopup>;
            close: Subject<string>;
        };
        toolbar: {
            min: Subject<void>;
            max: Subject<void>;
            view: Subject<Declarations.AvailableToolbarTabs>;
        };
        sidebar: {
            min: Subject<void>;
            max: Subject<void>;
            view: Subject<Declarations.AvailableSidebarTabs>;
        };
        window: {
            resize: Subject<void>;
        };
        layout: {
            resize: Subject<void>;
        };
        row: {
            hover: Subject<Row | undefined>;
            rank: Subject<Declarations.UI.Rank>;
        };
    };

    private _subjects: Subject<unknown>[] = [];

    constructor() {
        this.system = {
            init: this._add<void>(new Subject<void>()),
            ready: this._add<void>(new Subject<void>()),
        };
        this.backend = {
            state: this._add<Declarations.BackendStateEvent>(
                new Subject<Declarations.BackendStateEvent>(),
            ),
            job: this._add<Declarations.JobEvent>(new Subject<Declarations.JobEvent>()),
        };
        this.ux = {
            hotkey: this._add<Declarations.HotkeyEvent>(new Subject<Declarations.HotkeyEvent>()),
        };
        this.session = {
            close: this._add<string>(new Subject<string>()),
            open: this._add<string>(new Subject<string>()),
            change: this._add<string | undefined>(new Subject<string | undefined>()),
            stream: {
                updated: this._add<Declarations.Stream.Updated.Event>(
                    new Subject<Declarations.Stream.Updated.Event>(),
                ),
            },
            search: {
                updated: this._add<Declarations.Search.Updated.Event>(
                    new Subject<Declarations.Search.Updated.Event>(),
                ),
            },
        };
        this.ui = {
            contextmenu: {
                open: this._add<Declarations.IMenu>(new Subject<Declarations.IMenu>()),
                close: this._add<void>(new Subject<void>()),
            },
            popup: {
                open: this._add<Declarations.IPopup>(new Subject<Declarations.IPopup>()),
                close: this._add<string>(new Subject<string>()),
            },
            toolbar: {
                min: this._add<void>(new Subject<void>()),
                max: this._add<void>(new Subject<void>()),
                view: this._add<Declarations.AvailableToolbarTabs>(
                    new Subject<Declarations.AvailableToolbarTabs>(),
                ),
            },
            sidebar: {
                min: this._add<void>(new Subject<void>()),
                max: this._add<void>(new Subject<void>()),
                view: this._add<Declarations.AvailableSidebarTabs>(
                    new Subject<Declarations.AvailableSidebarTabs>(),
                ),
            },
            window: {
                resize: this._add<void>(new Subject<void>()),
            },
            layout: {
                resize: this._add<void>(new Subject<void>()),
            },
            row: {
                hover: this._add<Row | undefined>(new Subject<Row | undefined>()),
                rank: this._add<Declarations.UI.Rank>(new Subject<Declarations.UI.Rank>()),
            },
        };
    }

    public destroy() {
        this._subjects.forEach((subject) => {
            subject.destroy();
        });
    }

    private _add<T>(subject: Subject<T>): Subject<T> {
        this._subjects.push(subject as Subject<unknown>);
        return subject;
    }
}
