import * as Toolkit from 'logviewer.client.toolkit';
import { Observable, Subscription, Subject } from 'rxjs';
import { ControllerSessionScope } from '../../../controller/controller.session.tab.scope';
import { ControllerSessionTab } from '../../../controller/controller.session.tab';
import TabsSessionsService from '../../../services/service.sessions.tabs';

export interface IPositionChange {
    left: number;
    width: number;
    full: number;
    w?: number;
    l?: number;
}

const CSettings = {
    serviceScopeKey: 'chart-position-service-state',
};

export class ServicePosition {

    private _position: IPositionChange | undefined;
    private _subscriptions: { [key: string]: Subscription } = {};
    private _sessionController: ControllerSessionTab | undefined;
    private _subjects: {
        onChange: Subject<IPositionChange>,
        onSwitch: Subject<IPositionChange>,
    } = {
        onChange: new Subject<IPositionChange>(),
        onSwitch: new Subject<IPositionChange>(),
    };

    constructor() {
        this._subscriptions.onSessionChange = TabsSessionsService.getObservable().onSessionChange.subscribe(this._onSessionChange.bind(this));
        this._init();
    }

    public destroy() {
        this._saveState();
        /*
        Object.keys(this._subjects).forEach((key: string) => {
            this._subjects[key].unsubscribe();
        });
        */
    }

    public set(position: IPositionChange) {
        this._position = position;
        this._subjects.onChange.next(position);
    }

    public get(): IPositionChange | undefined {
        return this._position;
    }

    public getObservable(): {
        onChange: Observable<IPositionChange>,
        onSwitch: Observable<IPositionChange>,
    } {
        return {
            onChange: this._subjects.onChange.asObservable(),
            onSwitch: this._subjects.onSwitch.asObservable(),
        };
    }

    private _init(controller?: ControllerSessionTab) {
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
        const state: IPositionChange | undefined = scope.get<IPositionChange>(CSettings.serviceScopeKey);
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

    private _onSessionChange(controller: ControllerSessionTab) {
        if (controller === undefined) {
            return;
        }
        this._init(controller);
    }

}
