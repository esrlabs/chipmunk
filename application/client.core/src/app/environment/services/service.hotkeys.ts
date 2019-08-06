import * as Toolkit from 'logviewer.client.toolkit';
import { IService } from '../interfaces/interface.service';
import { Observable, Subject } from 'rxjs';

export const CKeys = {
    KeyS: { key: 'KeyS', name: 'Search', description: 'Focus search input', subject: 'onSearchFocus' },
    KeyT: { key: 'KeyT', name: 'Tab', description: 'Open new tab', subject: 'onNewTab' }
};

export class HotkeysService implements IService {

    private _logger: Toolkit.Logger = new Toolkit.Logger('HotkeysService');

    private _subjects = {
        onNewTab: new Subject<void>(),
        onSearchFocus: new Subject<void>(),
    };

    constructor() {
        this._onKeyPress = this._onKeyPress.bind(this);
    }

    public init(): Promise<void> {
        return new Promise((resolve) => {
            window.addEventListener('keypress', this._onKeyPress);
            resolve();
        });
    }

    public getName(): string {
        return 'HotkeysService';
    }

    public desctroy(): Promise<void> {
        return new Promise((resolve) => {
            window.removeEventListener('keypress', this._onKeyPress);
            resolve();
        });
    }

    public getObservable(): {
        onNewTab: Observable<void>,
        onSearchFocus: Observable<void>,
    } {
        return {
            onNewTab: this._subjects.onNewTab.asObservable(),
            onSearchFocus: this._subjects.onSearchFocus.asObservable(),
        };
    }

    private _onKeyPress(event: KeyboardEvent) {
        if (!event.ctrlKey) {
            return;
        }
        if (CKeys[event.code] === undefined) {
            return;
        }
        const subject: string | undefined = CKeys[event.code].subject;
        if (this._subjects[subject] === undefined) {
            return;
        }
        this._subjects[subject].next();
    }

}

export default (new HotkeysService());
