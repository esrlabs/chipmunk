import { Observable, Subject } from 'rxjs';

type TStateGetter = () => boolean;

export class LayoutStateService {
    private _locked: boolean = false;
    private _isToolbarMin: TStateGetter | undefined;
    private _isSidebarMin: TStateGetter | undefined;
    private _state: {
        toolbar: boolean;
        sidebar: boolean;
    } = {
        toolbar: true,
        sidebar: false,
    };
    private _subjects: {
        onSidebarMin: Subject<void>;
        onSidebarMax: Subject<void>;
        onToolbarMin: Subject<void>;
        onToolbarMax: Subject<void>;
    } = {
        onSidebarMin: new Subject<void>(),
        onSidebarMax: new Subject<void>(),
        onToolbarMin: new Subject<void>(),
        onToolbarMax: new Subject<void>(),
    };

    public getObservable(): {
        onSidebarMin: Observable<void>;
        onSidebarMax: Observable<void>;
        onToolbarMin: Observable<void>;
        onToolbarMax: Observable<void>;
    } {
        return {
            onSidebarMin: this._subjects.onSidebarMin.asObservable(),
            onSidebarMax: this._subjects.onSidebarMax.asObservable(),
            onToolbarMin: this._subjects.onToolbarMin.asObservable(),
            onToolbarMax: this._subjects.onToolbarMax.asObservable(),
        };
    }

    public setToolBarStateGetter(getter: TStateGetter) {
        this._isToolbarMin = getter;
    }

    public setSideBarStateGetter(getter: TStateGetter) {
        this._isSidebarMin = getter;
    }

    public lock() {
        this._saveState();
        this._subjects.onSidebarMin.next();
        this._subjects.onToolbarMin.next();
        this._locked = true;
    }

    public unlock() {
        this._locked = false;
        this._loadState();
    }

    public locked(): boolean {
        return this._locked;
    }

    public sidebarMin() {
        if (this._locked) {
            return;
        }
        this._subjects.onSidebarMin.next();
    }

    public sidebarMax() {
        if (this._locked) {
            return;
        }
        this._subjects.onSidebarMax.next();
    }

    public toolbarMin() {
        if (this._locked) {
            return;
        }
        this._subjects.onToolbarMin.next();
    }

    public toolbarMax() {
        if (this._locked) {
            return;
        }
        this._subjects.onToolbarMax.next();
    }

    private _saveState() {
        if (this._isSidebarMin === undefined || this._isToolbarMin === undefined) {
            return;
        }
        this._state.toolbar = !this._isToolbarMin();
        this._state.sidebar = !this._isSidebarMin();
    }

    private _loadState() {
        if (this._state.toolbar) {
            this._subjects.onToolbarMax.next();
        }
        if (this._state.sidebar) {
            this._subjects.onSidebarMax.next();
        }
    }
}

export default new LayoutStateService();
