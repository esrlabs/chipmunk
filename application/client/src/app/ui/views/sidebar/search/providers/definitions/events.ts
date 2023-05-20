import { Subject } from '@platform/env/subscription';
import { ISelectEvent, IContextMenuEvent, IDoubleclickEvent } from './provider';

export interface ProvidersEvents {
    select: Subject<ISelectEvent | undefined>;
    context: Subject<IContextMenuEvent>;
    doubleclick: Subject<IDoubleclickEvent>;
    change: Subject<void>;
    edit: Subject<string | undefined>;
    dragging: Subject<void>;
}

export interface ProviderEvents {
    change: Subject<void>;
    selection: Subject<ISelectEvent>;
    edit: Subject<string | undefined>;
    context: Subject<IContextMenuEvent>;
    doubleclick: Subject<IDoubleclickEvent>;
    reload: Subject<string>;
}
