import * as Toolkit from 'logviewer.client.toolkit';
import { IService } from '../interfaces/interface.service';
import { Observable, Subject } from 'rxjs';

export type TSidebarGUID = string;

export class SidebarService implements IService {

    private _logger: Toolkit.Logger = new Toolkit.Logger('SidebarService');
    private _pending: File[] = [];
    private _subjects = {
        onChange: new Subject<TSidebarGUID>(),
    };
    constructor() {

    }

    public init(): Promise<void> {
        return new Promise((resolve) => {
            resolve();
        });
    }

    public getName(): string {
        return 'SidebarService';
    }

    public desctroy(): Promise<void> {
        return new Promise((resolve) => {
            resolve();
        });
    }

    public getObservable(): {
        onChange: Observable<TSidebarGUID>,
    } {
        return {
            onChange: this._subjects.onChange.asObservable(),
        };
    }


}

export default (new SidebarService());
