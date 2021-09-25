import * as Toolkit from 'chipmunk.client.toolkit';
import { Subject, Observable } from 'rxjs';

export interface ISize {
    width: number;
    height: number;
}
export class CustomTabsEventsService {
    private _logger: Toolkit.Logger = new Toolkit.Logger('CustomTabsEventsService');
    private _subjects: {
        plugins: Subject<void>;
    } = {
        plugins: new Subject<void>(),
    };

    constructor() {}

    public getObservable(): {
        plugins: Observable<void>;
    } {
        return {
            plugins: this._subjects.plugins.asObservable(),
        };
    }

    public emit(): {
        plugins: () => void;
    } {
        return {
            plugins: () => {
                this._subjects.plugins.next();
            },
        };
    }
}

export default new CustomTabsEventsService();
