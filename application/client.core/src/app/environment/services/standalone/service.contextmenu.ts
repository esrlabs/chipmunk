import { Observable, Subject } from 'rxjs';
import * as Toolkit from 'chipmunk.client.toolkit';
import { IComponentDesc } from 'chipmunk-client-material';

export interface IMenuItem {
    id?: string;
    caption?: string;
    handler?: () => void;
    disabled?: boolean;
    shortcut?: string;
}

export interface IMenu {
    id?: string;
    component?: IComponentDesc;
    items?: IMenuItem[];
    x: number;
    y: number;
}

export enum EEventType {
    keydown = 'keydown',
    mousedown = 'mousedown',
}

type TEvent = MouseEvent | KeyboardEvent;

export class ContextMenuService {
    private _subjects: {
        onShow: Subject<IMenu>;
        onRemove: Subject<void>;
    } = {
        onShow: new Subject<IMenu>(),
        onRemove: new Subject<void>(),
    };

    public getObservable(): {
        onShow: Observable<IMenu>;
        onRemove: Observable<void>;
    } {
        return {
            onShow: this._subjects.onShow.asObservable(),
            onRemove: this._subjects.onRemove.asObservable(),
        };
    }

    public subscribeToWinEvents(type: EEventType, func: (event: any) => void) {
        window.addEventListener(type, func, true);
    }

    public unsubscribeToWinEvents(type: EEventType, func: (event: any) => void) {
        window.removeEventListener(type, func);
    }

    public show(menu: IMenu): string {
        if (typeof menu.id !== 'string' || menu.id.trim() === '') {
            menu.id = Toolkit.guid();
        }
        this._subjects.onShow.next(menu);
        return menu.id;
    }

    public remove(): void {
        this._subjects.onRemove.next();
    }
}

export default new ContextMenuService();
