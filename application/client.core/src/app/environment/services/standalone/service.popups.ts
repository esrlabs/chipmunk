import { Observable, Subject } from 'rxjs';
import * as Toolkit from 'logviewer.client.toolkit';

export interface IOptions {
    closable?: boolean;
    width?: number;
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


    public getObservable(): {
        onNew: Observable<IPopup>,
        onRemove: Observable<string>,
    } {
        return {
            onNew: this._subjects.onNew.asObservable(),
            onRemove: this._subjects.onRemove.asObservable(),
        };
    }

    add(popup: IPopup): string {
        if (typeof popup.id !== 'string' || popup.id.trim() === '') {
            popup.id = Toolkit.guid();
        }
        this._subjects.onNew.next(popup);
        return popup.id;
    }

    remove(guid: string) {
        this._subjects.onRemove.next(guid);
    }

}

export default (new PopupsService());
