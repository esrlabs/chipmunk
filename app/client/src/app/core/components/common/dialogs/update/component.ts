import {Component, Input                    } from '@angular/core';
import { events as Events                   } from '../../../../modules/controller.events';
import { configuration as Configuration     } from '../../../../modules/controller.config';
import { UpdateInfo, DownloadProgressState  } from '../../../../modules/controller.updater';

@Component({
    selector    : 'dialog-update',
    templateUrl : './template.html',
})

export class DialogUpdate {
    @Input() info       : any = null;
    @Input() progress   : string | number = null;
    @Input() speed      : string | number = null;


    private _version    : string = '';
    private _progress   : string | number = null;
    private _speed      : string | number = null;

    constructor() {
        Events.bind(Configuration.sets.SYSTEM_EVENTS.UPDATE_IS_AVAILABLE,       this.UPDATE_IS_AVAILABLE.bind(this));
        Events.bind(Configuration.sets.SYSTEM_EVENTS.UPDATE_DOWNLOAD_PROGRESS,  this.UPDATE_DOWNLOAD_PROGRESS.bind(this));
    }

    UPDATE_IS_AVAILABLE(info: UpdateInfo){
        this._version   = info.info !== void 0 ? (info.info.version !== null ? info.info.version: null) : null;
    }

    UPDATE_DOWNLOAD_PROGRESS(state: DownloadProgressState){
        let speed = state.speed       !== void 0 ? (state.speed as number) / 1024 : null;

        this._version   = state.info        !== void 0  ? (state.info.version !== null ? state.info.version: null) : null;
        this._progress  = state.progress    !== void 0  ? state.progress                : null;
        this._speed     = speed             !== null    ? speed.toFixed(2)  : null;
    }

}
