import { Observable, Subject } from 'rxjs';

export class LayoutStateService {

    private _subjects: {
        onSidebarMin: Subject<void>,
        onSidebarMax: Subject<void>,
        onToolbarMin: Subject<void>,
        onToolbarMax: Subject<void>,
    } = {
        onSidebarMin: new Subject<void>(),
        onSidebarMax: new Subject<void>(),
        onToolbarMin: new Subject<void>(),
        onToolbarMax: new Subject<void>(),
    };

    public getObservable(): {
        onSidebarMin: Observable<void>,
        onSidebarMax: Observable<void>,
        onToolbarMin: Observable<void>,
        onToolbarMax: Observable<void>,
    } {
        return {
            onSidebarMin: this._subjects.onSidebarMin.asObservable(),
            onSidebarMax: this._subjects.onSidebarMax.asObservable(),
            onToolbarMin: this._subjects.onToolbarMin.asObservable(),
            onToolbarMax: this._subjects.onToolbarMax.asObservable(),
        };
    }

    public sidebarMin() {
        this._subjects.onSidebarMin.next();
    }

    public sidebarMax() {
        this._subjects.onSidebarMax.next();
    }

    public toolbarMin() {
        this._subjects.onToolbarMin.next();
    }

    public toolbarMax() {
        this._subjects.onToolbarMax.next();
    }
}

export default (new LayoutStateService());
