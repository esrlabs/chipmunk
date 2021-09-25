import { Observable, Subject } from 'rxjs';
import * as Toolkit from 'chipmunk.client.toolkit';
import PluginsService from '../service.plugins';

export class PopupsService {
    private _subjects: {
        onNew: Subject<Toolkit.IPopup>;
        onRemove: Subject<string>;
    } = {
        onNew: new Subject<Toolkit.IPopup>(),
        onRemove: new Subject<string>(),
    };

    private _opened: Map<string, boolean> = new Map();

    constructor() {
        this._onKeyUp = this._onKeyUp.bind(this);
        window.addEventListener('keyup', this._onKeyUp, true);
    }

    public getObservable(): {
        onNew: Observable<Toolkit.IPopup>;
        onRemove: Observable<string>;
    } {
        return {
            onNew: this._subjects.onNew.asObservable(),
            onRemove: this._subjects.onRemove.asObservable(),
        };
    }

    public add(popup: Toolkit.IPopup, noDuplicate: boolean = true): string | undefined {
        // Check before plugins factories
        if (popup.component === undefined) {
            return;
        }
        if (popup.component.factory === undefined) {
            return;
        }
        if (typeof popup.component.factory.name === 'string') {
            // If it's plugin, we should have stored factory of component (it was created in stored in PluginsService
            // during intialization of plugin). If it is - we should put instead component reference, reference to factory
            // and set it is "resolved"
            const factory = PluginsService.getStoredFactoryByName(popup.component.factory.name);
            if (factory !== undefined) {
                popup.component.factory = factory;
                popup.component.resolved = true;
            }
        }
        if (popup.options !== undefined && popup.id !== undefined) {
            if (popup.options.once === true && this._opened.has(popup.id)) {
                return;
            }
        }
        if (typeof popup.id !== 'string' || popup.id.trim() === '') {
            popup.id = Toolkit.guid();
        }
        if (noDuplicate && this._opened.has(popup.id)) {
            return undefined;
        }
        this._subjects.onNew.next(popup);
        this._opened.set(popup.id, true);
        return popup.id;
    }

    public remove(guid: string) {
        this._subjects.onRemove.next(guid);
        this._opened.delete(guid);
    }

    public clear(guid: string) {
        this._opened.delete(guid);
    }

    public close() {
        this.remove(this._opened.keys().next().value);
    }

    private _onKeyUp(event: KeyboardEvent) {
        if (event.key !== 'Escape' && event.key !== 'Enter') {
            return;
        }
        if (this._opened.size === 0) {
            return;
        }
        if (event.key === 'Escape') {
            this.close();
        }
    }
}

export default new PopupsService();
