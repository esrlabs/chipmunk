import * as Toolkit from 'chipmunk.client.toolkit';
import { Subject, Observable } from 'rxjs';

export interface ISize {
    width: number;
    height: number;
}

export class ViewsEventsService {
    private _logger: Toolkit.Logger = new Toolkit.Logger('ViewsEventsService');
    private _subjects: {
        onResize: Subject<ISize>;
        onRowHover: Subject<number>;
    } = {
        onResize: new Subject<ISize>(),
        onRowHover: new Subject<number>(),
    };

    constructor() {
        this._onWindowResize = this._onWindowResize.bind(this);
        window.addEventListener('resize', this._onWindowResize);
    }

    destroy() {
        window.removeEventListener('resize', this._onWindowResize);
    }

    public getObservable(): {
        onResize: Observable<ISize>;
        onRowHover: Observable<number>;
    } {
        return {
            onResize: this._subjects.onResize.asObservable(),
            onRowHover: this._subjects.onRowHover.asObservable(),
        };
    }

    public once(): {
        onResize: (handler: (size: ISize) => void) => void;
        onRowHover: (handler: (row: number) => void) => void;
    } {
        return {
            onResize: (handler: (size: ISize) => void) => {
                const subscription = this._subjects.onResize
                    .asObservable()
                    .subscribe((size: ISize) => {
                        subscription.unsubscribe();
                        handler(size);
                    });
            },
            onRowHover: (handler: (row: number) => void) => {
                const subscription = this._subjects.onRowHover
                    .asObservable()
                    .subscribe((row: number) => {
                        subscription.unsubscribe();
                        handler(row);
                    });
            },
        };
    }

    public fire(): {
        onResize: () => void;
        onRowHover: (position: number) => void;
    } {
        return {
            onResize: () => {
                this._onWindowResize();
            },
            onRowHover: (position: number) => {
                this._subjects.onRowHover.next(position);
            },
        };
    }

    private _onWindowResize() {
        this._subjects.onResize.next({
            height: window.innerHeight,
            width: window.innerWidth,
        });
    }
}

export default new ViewsEventsService();
