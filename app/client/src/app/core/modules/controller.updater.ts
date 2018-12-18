import { events as Events               } from './controller.events';
import { configuration as Configuration } from './controller.config';
import { popupController                } from '../components/common/popup/controller';
import { DialogUpdate                   } from '../components/common/dialogs/update/component';
import { DialogSettingsAutoExport       } from '../components/common/dialogs/app.settings/importer/auto.export/component';
import { APIResponse                    } from "../api/api.response.interface";
import { APICommands                    } from "../api/api.commands";
import { APIProcessor                   } from "../api/api.processor";
import { ProgressBarCircle              } from "../components/common/progressbar.circle/component";
import { versionController              } from "./controller.version";

interface ReleaseInfo{
    name: string
}

interface PackageInfo{
    release: ReleaseInfo
}

interface DownloadProgressState {
    total   : string,
    progress: string,
    done    : string,
    version : string
}

class Updater {

    private dialogGUID  : symbol = null;
    private processor   : any = APIProcessor;
    private info        : PackageInfo           = null;
    private state       : DownloadProgressState = null;

    constructor() {
        this.API_IS_READY_TO_USE        = this.API_IS_READY_TO_USE.bind(this);
        this.UPDATE_DOWNLOAD_PROGRESS   = this.UPDATE_DOWNLOAD_PROGRESS.bind(this);
        this.UPDATE_IS_AVAILABLE        = this.UPDATE_IS_AVAILABLE.bind(this);
        Events.bind(Configuration.sets.SYSTEM_EVENTS.API_IS_READY_TO_USE,       this.API_IS_READY_TO_USE);
        Events.bind(Configuration.sets.SYSTEM_EVENTS.UPDATE_IS_AVAILABLE,       this.UPDATE_IS_AVAILABLE);
        Events.bind(Configuration.sets.SYSTEM_EVENTS.UPDATE_DOWNLOAD_PROGRESS,  this.UPDATE_DOWNLOAD_PROGRESS);
    }

    private API_IS_READY_TO_USE(){
        this.processor.send(
            APICommands.checkUpdates,
            {},
            (response : APIResponse, error: Error) => {
                if (response.code === 10003) {
                    versionController.setAsWeb();
                } else {
                    versionController.setAsDesktop();
                }
            }
        );
    }

    private requestUpdate(){
        const guid = Symbol();
        popupController.open({
            content : {
                factory     : null,
                component   : DialogSettingsAutoExport,
                params      : {
                    onFinish:()=>{
                        popupController.close(guid);
                        const progressGUID = this.showProgress();
                        this.processor.send(
                            APICommands.update,
                            {},
                            (response : APIResponse, error: Error) => {
                                popupController.close(progressGUID);
                                this.openDialog();
                            }
                        );
                    }
                }
            },
            title   : 'Saving current settings...',
            settings: {
                move            : false,
                resize          : false,
                width           : '20rem',
                height          : '10rem',
                close           : false,
                addCloseHandle  : false,
                css             : ''
            },
            buttons         : [],
            titlebuttons    : [],
            GUID            : guid
        });
    }

    private UPDATE_IS_AVAILABLE(info: PackageInfo){
        if (this.info !== null) {
            return;
        }
        this.info = info;
        const version = typeof info === 'object' ? (info !== null ? (info.release !== void 0 ? (typeof info.release.name === 'string' ? info.release.name : null) : null) : null) : null
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.CREATE_NOTIFICATION, {
            caption: 'Update',
            message: `New version${version !== null ? ` (${version}) ` : ' '}is available. Do you want install it?`,
            buttons: [{ caption: 'Install', handler: ()=>{
                this.requestUpdate();
            }}, { caption: 'Later', handler: ()=>{
                this.info = null;
            }}]
        });
    }

    private UPDATE_DOWNLOAD_PROGRESS(state: DownloadProgressState){
        this.state = state;
        this.openDialog();
    }

    showProgress(){
        const progressGUID = Symbol();
        popupController.open({
            content : {
                factory     : null,
                component   : ProgressBarCircle,
                params      : {}
            },
            title   : 'Checking for updates...',
            settings: {
                move            : false,
                resize          : false,
                width           : '20rem',
                height          : '10rem',
                close           : false,
                addCloseHandle  : false,
                css             : ''
            },
            buttons         : [],
            titlebuttons    : [],
            GUID            : progressGUID
        });
        return progressGUID;
    }

    openDialog(){
        if (this.dialogGUID === null){
            this.dialogGUID = Symbol();
            popupController.open({
                content : {
                    factory     : null,
                    component   : DialogUpdate,
                    params      : {
                        version : this.state    !== null ? (this.state.version   !== void 0 ? this.state.version    : null) : null,
                        progress: this.state    !== null ? (this.state.progress   !== void 0 ? this.state.progress    : null) : null,
                        total   : this.state    !== null ? (this.state.total      !== void 0 ? this.state.total       : null) : null,
                        done    : this.state    !== null ? (this.state.done       !== void 0 ? this.state.done        : null) : null
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

export { Updater, PackageInfo, ReleaseInfo, DownloadProgressState }

