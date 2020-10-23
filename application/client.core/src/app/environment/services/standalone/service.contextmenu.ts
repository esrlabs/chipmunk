import { Observable, Subject } from 'rxjs';
import * as Toolkit from 'chipmunk.client.toolkit';
import { IComponentDesc } from 'chipmunk-client-material';

export interface IMenuItem {
    id?: string;
    caption?: string;
    handler?: () => void;
    disabled?: boolean;
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
    mousedown = 'mousedown'
}

type TEvent = MouseEvent | KeyboardEvent;
type TClose = () => void | undefined;

export class ContextMenuService {

    private _close: TClose;
    private _subjects: {
        onShow: Subject<IMenu>,
    } = {
        onShow: new Subject<IMenu>(),
    };

    public get close(): TClose {
        return this._close;
    }

    public set close(func: TClose) {
        this._close = func;
    }

    public getObservable(): {
        onShow: Observable<IMenu>,
    } {
        return {
            onShow: this._subjects.onShow.asObservable(),
        };
    }

    public subscribeToWinEvents(type: EEventType, func: (event: TEvent) => void) {
        window.addEventListener(type, func, true);
    }

    public unsubscribeToWinEvents(type: EEventType, func: (event: TEvent) => void) {
        window.removeEventListener(type, func);
    }

    show(menu: IMenu): string {
        if (typeof menu.id !== 'string' || menu.id.trim() === '') {
            menu.id = Toolkit.guid();
        }
        this._subjects.onShow.next(menu);
        return menu.id;
    }

}

export default (new ContextMenuService());
