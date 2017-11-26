import { events as Events               } from './controller.events';
import { configuration as Configuration } from './controller.config';
import { popupController                } from '../components/common/popup/controller';
import { DialogUpdate                   } from '../components/common/dialogs/update/component';

interface UpdateInfo{
    info    : any
}

interface DownloadProgressState {
    speed   : string | number,
    progress: string | number,
    info    : any
}

class Updater {
    private dialogGUID : symbol = null;

    private info  : UpdateInfo              = null;
    private state : DownloadProgressState   = null;

    constructor() {
        Events.bind(Configuration.sets.SYSTEM_EVENTS.UPDATE_IS_AVAILABLE,       this.UPDATE_IS_AVAILABLE.bind(this));
        Events.bind(Configuration.sets.SYSTEM_EVENTS.UPDATE_DOWNLOAD_PROGRESS,  this.UPDATE_DOWNLOAD_PROGRESS.bind(this));
    }

    UPDATE_IS_AVAILABLE(info: UpdateInfo){
        this.info = info;
        this.openDialog();
    }

    UPDATE_DOWNLOAD_PROGRESS(state: DownloadProgressState){
        this.state = state;
        this.openDialog();
    }

    openDialog(){
        if (this.dialogGUID === null){
            this.dialogGUID = Symbol();
            popupController.open({
                content : {
                    factory     : null,
                    component   : DialogUpdate,
                    params      : {
                        info    : this.info     !== null ? (this.info.info        !== void 0 ? this.info.info         : null) : null,
                        progress: this.state    !== null ? (this.state.progress   !== void 0 ? this.state.progress    : null) : null,
                        speed   : this.state    !== null ? (this.state.speed      !== void 0 ? this.state.speed       : null) : null
                    }
                },
                title   : _('Updating'),
                settings: {
                    move            : true,
                    resize          : true,
                    width           : '30rem',
                    height          : '10rem',
                    close           : true,
                    addCloseHandle  : true,
                    css             : ''
                },
                buttons         : [],
                titlebuttons    : [],
                GUID            : this.dialogGUID
            });
        }
    }

}

export { Updater, UpdateInfo, DownloadProgressState }

