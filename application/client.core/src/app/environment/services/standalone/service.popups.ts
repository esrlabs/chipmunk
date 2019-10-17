import { Observable, Subject } from 'rxjs';
import * as Toolkit from 'logviewer.client.toolkit';

export interface IOptions {
    closable?: boolean;
    width?: number;
    once?: boolean;
}

export interface IButton {
    caption: string;
    handler: (...args: any[]) => any;
}

export interface IComponent {
    factory: any;
    inputs: any;
}

export interface IPopup {
    id?: string;
    caption: string;
    message?: string;
    component?: IComponent;
    buttons?: IButton[];
    options?: IOptions;
}

export class PopupsService {

    private _subjects: {
        onNew: Subject<IPopup>,
        onRemove: Subject<string>,
    } = {
        onNew: new Subject<IPopup>(),
        onRemove: new Subject<string>(),
    };

    private _opened: Map<string, boolean> = new Map();

    constructor() {
        this._onKeyUp = this._onKeyUp.bind(this);
        window.addEventListener('keyup', this._onKeyUp, true);
    }

    public getObservable(): {
        onNew: Observable<IPopup>,
        onRemove: Observable<string>,
    } {
        return {
            onNew: this._subjects.onNew.asObservable(),
            onRemove: this._subjects.onRemove.asObservable(),
        };
    }

    public add(popup: IPopup): string {
        if (popup.options !== undefined) {
            if (popup.options.once === true && this._opened.has(popup.id)) {
                return;
            }
        }
        if (typeof popup.id !== 'string' || popup.id.trim() === '') {
            popup.id = Toolkit.guid();
        }
        this._subjects.onNew.next(popup);
        this._opened.set(popup.id, true);
        return popup.id;
    }

    public remove(guid: string) {
        this._subjects.onRemove.next(guid);
        this._opened.delete(guid);
    }

    public clear(guid: string) {
        this._opened.delete(guid);
    }

    private _onKeyUp(event: KeyboardEvent) {
        if (event.key !== 'Escape') {
            return;
        }
        if (this._opened.size === 0) {
            return;
        }
        this.remove(this._opened.keys().next().value);
    }

}

export default (new PopupsService());
