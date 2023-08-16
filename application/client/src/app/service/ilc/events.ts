import { Subject } from '@platform/env/subscription';
import { Row } from '@schema/content/row';
import { Base } from '../session/base';
import { Session } from '../session/session';

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
        closed: Subject<string>;
        open: Subject<Base>;
        created: Subject<Session>;
        change: Subject<string | undefined>;
        closing: Subject<Base>;
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
            open: Subject<Declarations.Popup>;
            close: Subject<string>;
            updated: Subject<number>;
        };
        toolbar: {
            min: Subject<void>;
            max: Subject<void>;
            occupy: Subject<void>;
            state: Subject<
                (state: { min: boolean; max: boolean; occupied: boolean; size: number }) => void
            >;
            resize: Subject<void>;
            view: Subject<Declarations.AvailableToolbarTabs>;
        };
        sidebar: {
            min: Subject<void>;
            max: Subject<void>;
            resize: Subject<void>;
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
        };
        input: {
            focused: Subject<void>;
            blur: Subject<void>;
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
            closed: this._add<string>(new Subject<string>()),
            open: this._add<Base>(new Subject<Base>()),
            created: this._add<Session>(new Subject<Session>()),
            change: this._add<string | undefined>(new Subject<string | undefined>()),
            closing: this._add<Base>(new Subject<Base>()),
        };
        this.ui = {
            contextmenu: {
                open: this._add<Declarations.IMenu>(new Subject<Declarations.IMenu>()),
                close: this._add<void>(new Subject<void>()),
            },
            popup: {
                open: this._add<Declarations.Popup>(new Subject<Declarations.Popup>()),
                close: this._add<string>(new Subject<string>()),
                updated: this._add<number>(new Subject<number>()),
            },
            toolbar: {
                min: this._add<void>(new Subject<void>()),
                max: this._add<void>(new Subject<void>()),
                occupy: this._add<void>(new Subject<void>()),
                state: this._add<
                    (state: { min: boolean; max: boolean; occupied: boolean; size: number }) => void
                >(
                    new Subject<
                        (state: {
                            min: boolean;
                            max: boolean;
                            occupied: boolean;
                            size: number;
                        }) => void
                    >(),
                ),
                resize: this._add<void>(new Subject<void>()).balanced(25),
                view: this._add<Declarations.AvailableToolbarTabs>(
                    new Subject<Declarations.AvailableToolbarTabs>(),
                ),
            },
            sidebar: {
                min: this._add<void>(new Subject<void>()),
                max: this._add<void>(new Subject<void>()),
                resize: this._add<void>(new Subject<void>()).balanced(25),
                view: this._add<Declarations.AvailableSidebarTabs>(
                    new Subject<Declarations.AvailableSidebarTabs>(),
                ),
            },
            window: {
                resize: this._add<void>(new Subject<void>().balanced(25)),
            },
            layout: {
                resize: this._add<void>(new Subject<void>()),
            },
            input: {
                focused: this._add<void>(new Subject<void>()),
                blur: this._add<void>(new Subject<void>()),
            },
            row: {
                hover: this._add<Row | undefined>(new Subject<Row | undefined>()),
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
