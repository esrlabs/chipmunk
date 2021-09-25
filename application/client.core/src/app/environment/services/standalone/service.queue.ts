import * as Toolkit from 'chipmunk.client.toolkit';
import { Observable, Subject } from 'rxjs';

export interface IQueueState {
    done: number;
    count: number;
    title: string;
}

export interface IQueueController {
    next: (done: number, count: number) => void;
    done: () => void;
}

export class QueueService {
    private _logger: Toolkit.Logger = new Toolkit.Logger('QueueService');
    private _subjects: { [key: string]: Subject<any> } = {
        next: new Subject<IQueueState>(),
        done: new Subject<string>(),
    };

    public getObservable(): {
        next: Observable<IQueueState>;
        done: Observable<string>;
    } {
        return {
            next: this._subjects.next.asObservable(),
            done: this._subjects.done.asObservable(),
        };
    }

    public create(title: string): IQueueController {
        return {
            next: this._next.bind(this, title),
            done: this._done.bind(this, title),
        };
    }

    private _done(title: string) {
        this._subjects.done.next(title);
    }

    private _next(title: string, done: number, count: number) {
        this._subjects.next.next({
            done: done,
            count: count,
            title: title,
        });
    }
}

export default new QueueService();
