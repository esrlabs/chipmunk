import * as Toolkit from 'logviewer.client.toolkit';
import { Subject, Observable } from 'rxjs';

export interface ISize {
    width: number;
    height: number;
}
export class ViewsEventsService {

    private _logger: Toolkit.Logger = new Toolkit.Logger('ViewsEventsService');
    private _subjects: {
        onResize: Subject<ISize>,
    } = {
        onResize: new Subject<ISize>()
    };

    constructor() {
        this._onWindowResize = this._onWindowResize.bind(this);
        window.addEventListener('resize', this._onWindowResize);
    }

    destroy() {
        window.removeEventListener('resize', this._onWindowResize);
    }

    public getObservable(): {
        onResize: Observable<ISize>
    } {
        return {
            onResize: this._subjects.onResize.asObservable(),
        };
    }

    public fire(): {
        onResize: () => void
    } {
        return {
            onResize: () => { this._onWindowResize(); }
        };
    }

    private _onWindowResize() {
        this._subjects.onResize.next({
            height: window.innerHeight,
            width: window.innerWidth
        });
    }

}

export default (new ViewsEventsService());
