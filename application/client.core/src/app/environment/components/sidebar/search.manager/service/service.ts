import { Observable, Subject } from 'rxjs';

export class SearchManagerService {

    private _subjects = {
        remove: new Subject<void>(),
        drag: new Subject<boolean>(),
    };

    public getObservable(): {
        remove: Observable<void>,
        drag: Observable<boolean>,
    } {
        return {
            remove: this._subjects.remove.asObservable(),
            drag: this._subjects.drag.asObservable(),
        };
    }

    public onBinDrop() {
        this._subjects.remove.next();
    }

    public onDragStart(status: boolean) {
        this._subjects.drag.next(status);
    }

}

export default (new SearchManagerService());
