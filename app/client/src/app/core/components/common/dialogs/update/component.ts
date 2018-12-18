import {Component, Input                    } from '@angular/core';
import { events as Events                   } from '../../../../modules/controller.events';
import { configuration as Configuration     } from '../../../../modules/controller.config';
import { PackageInfo, DownloadProgressState  } from '../../../../modules/controller.updater';

@Component({
    selector    : 'dialog-update',
    templateUrl : './template.html',
})

export class DialogUpdate {
    @Input() version    : string = null;
    @Input() progress   : string = null;
    @Input() total      : string = null;
    @Input() done       : string = null;


    private _version    : string = '';
    private _progress   : number = null;
    private _total      : string = null;
    private _done       : string = null;

    constructor() {
        Events.bind(Configuration.sets.SYSTEM_EVENTS.UPDATE_IS_AVAILABLE,       this.UPDATE_IS_AVAILABLE.bind(this));
        Events.bind(Configuration.sets.SYSTEM_EVENTS.UPDATE_DOWNLOAD_PROGRESS,  this.UPDATE_DOWNLOAD_PROGRESS.bind(this));
    }

    UPDATE_IS_AVAILABLE(info: PackageInfo){
        this._version   = info.release !== void 0 ? (info.release.name !== null ? info.release.name: null) : null;
    }

    UPDATE_DOWNLOAD_PROGRESS(state: DownloadProgressState){
        this._version   = state.version     !== void 0  ? state.version     : null;
        this._progress  = state.progress    !== void 0  ? parseInt(state.progress, 10)                  : null;
        this._total     = state.total       !== null    ? (parseInt(state.total, 10) / 1024).toFixed(2) : null;
        this._done      = state.done        !== null    ? (parseInt(state.done, 10) / 1024).toFixed(2)  : null;
    }


}
