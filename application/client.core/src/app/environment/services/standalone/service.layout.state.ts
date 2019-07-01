import { Observable, Subject } from 'rxjs';

export class LayoutStateService {

    private _subjects: {
        onSidebarMin: Subject<void>,
        onSidebarMax: Subject<void>
    } = {
        onSidebarMin: new Subject<void>(),
        onSidebarMax: new Subject<void>()
    };


    public getObservable(): {
        onSidebarMin: Observable<void>,
        onSidebarMax: Observable<void>,
    } {
        return {
            onSidebarMin: this._subjects.onSidebarMin.asObservable(),
            onSidebarMax: this._subjects.onSidebarMax.asObservable()
        };
    }

    public sidebarMin() {
        this._subjects.onSidebarMin.next();
    }

    public sidebarMax() {
        this._subjects.onSidebarMax.next();
    }
}

export default (new LayoutStateService());
