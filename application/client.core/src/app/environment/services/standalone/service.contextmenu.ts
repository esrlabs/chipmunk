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

export class ContextMenuService {

    private _subjects: {
        onShow: Subject<IMenu>,
    } = {
        onShow: new Subject<IMenu>(),
    };


    public getObservable(): {
        onShow: Observable<IMenu>,
    } {
        return {
            onShow: this._subjects.onShow.asObservable(),
        };
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
