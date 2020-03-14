import { Observable, Subject } from 'rxjs';
import ViewsEventsService from '../services/standalone/service.views.events';
import LayoutStateService from '../services/standalone/service.layout.state';

export class AreaState {

    public minimized: boolean = true;

    private _subjects = {
        minimized: new Subject<boolean>(),
        updated: new Subject<AreaState>()
    };

    public getObservable(): {
        minimized: Observable<boolean>,
        updated: Observable<AreaState>,
    } {
        return {
            minimized: this._subjects.minimized.asObservable(),
            updated: this._subjects.updated.asObservable(),
        };
    }

    public minimize() {
        if (LayoutStateService.locked()) {
            return;
        }
        this.minimized = true;
        this._subjects.minimized.next(this.minimized);
        this._subjects.updated.next(this);
        ViewsEventsService.fire().onResize();
    }

    public maximize() {
        if (LayoutStateService.locked()) {
            return;
        }
        this.minimized = false;
        this._subjects.minimized.next(this.minimized);
        this._subjects.updated.next(this);
        ViewsEventsService.fire().onResize();
    }
}
