import { Observable, Subscription, Subject } from 'rxjs';
import { ControllerSessionScope } from '../../../controller/session/dependencies/scope/controller.session.tab.scope';
import { Session } from '../../../controller/session/session';

import TabsSessionsService from '../../../services/service.sessions.tabs';

export interface IPositionChange {
    left: number;
    width: number;
    full: number;
}

export interface IPositionForce {
    deltaY: number;
    proportionX: number;
}

const CSettings = {
    serviceScopeKey: 'chart-position-service-state',
};

export class ServicePosition {
    private _position: IPositionChange | undefined;
    private _subscriptions: { [key: string]: Subscription } = {};
    private _sessionController: Session | undefined;
    private _subjects: {
        onChange: Subject<IPositionChange>;
        onForce: Subject<IPositionForce>;
        onSwitch: Subject<IPositionChange>;
    } = {
        onChange: new Subject<IPositionChange>(),
        onForce: new Subject<IPositionForce>(),
        onSwitch: new Subject<IPositionChange>(),
    };

    constructor() {
        this._init();
    }

    public destroy() {
        this._saveState();
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public set(position: IPositionChange) {
        this._position = position;
        this._subjects.onChange.next(position);
    }

    public force(changes: IPositionForce) {
        this._subjects.onForce.next(changes);
    }

    public get(): IPositionChange | undefined {
        return this._position;
    }

    public getObservable(): {
        onChange: Observable<IPositionChange>;
        onSwitch: Observable<IPositionChange>;
        onForce: Observable<IPositionForce>;
    } {
        return {
            onChange: this._subjects.onChange.asObservable(),
            onSwitch: this._subjects.onSwitch.asObservable(),
            onForce: this._subjects.onForce.asObservable(),
        };
    }

    public correction(width: number) {
        if (this._position === undefined) {
            return;
        }
        if (this._position.full === width) {
            return;
        }
        const change: number = width / this._position.full;
        this._position.width = this._position.width * change;
        this._position.left = this._position.left * change;
    }

    private _init(controller?: Session) {
        const init: boolean = controller === undefined;
        controller = controller === undefined ? TabsSessionsService.getActive() : controller;
        if (controller === undefined) {
            return;
        }
        this._saveState();
        // Store controller
        this._sessionController = controller;
        this._loadState();
        if (!init && this._position !== undefined) {
            this._subjects.onSwitch.next(this._position);
        }
    }

    private _loadState() {
        if (this._sessionController === undefined) {
            return;
        }
        const scope: ControllerSessionScope = this._sessionController.getScope();
        const state: IPositionChange | undefined = scope.get<IPositionChange>(
            CSettings.serviceScopeKey,
        );
        if (state === undefined) {
            this._position = undefined;
        } else {
            this._position = Object.assign({}, state);
            this._subjects.onChange.next(this._position);
        }
    }

    private _saveState() {
        if (this._sessionController === undefined) {
            return;
        }
        if (this._position === undefined) {
            // Nothing to save
            return;
        }
        const scope: ControllerSessionScope = this._sessionController.getScope();
        scope.set<IPositionChange>(CSettings.serviceScopeKey, Object.assign({}, this._position));
    }
}
