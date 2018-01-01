import { MenuHandleInterface            } from './handle.interface';
import { popupController                } from '../components/common/popup/controller';
import { ProgressBarCircle              } from '../components/common/progressbar.circle/component';
import { SimpleText                     } from '../components/common/text/simple/component';

import { events as Events               } from '../modules/controller.events';
import { configuration as Configuration } from '../modules/controller.config';

import { APIProcessor                   } from '../api/api.processor';
import { APICommands                    } from '../api/api.commands';
import { APIResponse                    } from '../api/api.response.interface';
import { DialogMonitorManager           } from '../components/common/dialogs/monitor.manager/component';

import { DefaultsPortSettings           } from '../components/common/dialogs/serial.settings/defaults.settings';

class DefaultMonitorSettings {
    public timeoutOnError   : number = 5000;//ms
    public timeoutOnClose   : number = 5000;
    public maxFileSizeMB    : number = 30;
    public maxFilesCount    : number = 30;
    public port             : string = '';
    public portSettings     : DefaultsPortSettings = new DefaultsPortSettings();
    public path             : string = '';
    public command          : string = '';
}

class DefaultMonitorState {
    public active   : boolean   = false;
    public port     : string    = '';
    public spawn    : string    = '';
}

interface MonitorSettings {
    timeoutOnError  : number,
    timeoutOnClose  : number,
    maxFileSizeMB   : number,
    maxFilesCount   : number,
    port            : string,
    portSettings    : DefaultsPortSettings,
    path            : string,
    command         : string
}

interface MonitorState {
    active  : boolean,
    port    : string,
    spawn   : string
}

class OpenMonitorManager implements MenuHandleInterface{
    private progressGUID    : symbol                = Symbol();
    private processor       : any                   = APIProcessor;
    private settings        : MonitorSettings       = null;
    private button          : {
        id: symbol | null,
        icon: string,
        caption: string
    } = {
        id: null,
        icon: 'fa-stethoscope',
        caption: 'Monitor Manager'
    };

    constructor(){
        this.start = this.start.bind(this);
    }

    init(){
        Events.bind(Configuration.sets.SYSTEM_EVENTS.API_IS_READY_TO_USE,   this.onAPI_IS_READY_TO_USE.bind(this));
        Events.bind(Configuration.sets.SYSTEM_EVENTS.WS_DISCONNECTED,       this.onWS_DISCONNECTED.bind(this));
    }

    onAPI_IS_READY_TO_USE(){
        this.getStateMonitor((state: MonitorState) => {
            this.updateState(state !== null ? state : (new DefaultMonitorState()));
        });
    }

    onWS_DISCONNECTED(){
        this.updateState(new DefaultMonitorState());
    }

    getMonitorSettings(callback: Function){
        this.processor.send(
            APICommands.getSettingsMonitor,
            {},
            (response: any)=>{
                if (typeof response === 'object' && response !== null && typeof response.output === 'object' && response.output !== null){
                    this.onGetMonitorSettings(callback, response.output as MonitorSettings);
                } else {
                    this.onGetMonitorSettings(callback, null);
                }
            }
        );
    }

    onGetMonitorSettings(callback: Function, settings: MonitorSettings) {
        let validSettings   = true;
        this.settings       = settings;
        if (this.settings === null || typeof this.settings !== 'object') {
            validSettings   = false;
        } else {
            let defaults    = new DefaultMonitorSettings();
            Object.keys(defaults).forEach((key)=>{
                if (this.settings[key] === void 0 || typeof this.settings[key] !== typeof defaults[key]){
                    validSettings = false;
                }
            });
        }
        if (!validSettings) {
            this.settings = new DefaultMonitorSettings();
            this.dropSettings();
        }
        typeof callback === 'function' && callback(Object.assign({}, settings));
    }

    updateState(state: MonitorState){
        if (state.active) {
            this.button.id === null && this.addToolBarButton();
        } else {
            this.button.id !== null && this.removeToolBarButton();
        }
    }

    addToolBarButton(){
        this.button.id = Symbol();
        Events.trigger(Configuration.sets.EVENTS_TOOLBAR.ADD_BUTTON, [
            { id : this.button.id, icon: this.button.icon, caption: this.button.caption, handle: this.start, enable: true},
        ]);
    }

    removeToolBarButton(){
        Events.trigger(Configuration.sets.EVENTS_TOOLBAR.REMOVE_BUTTON, this.button.id);
        this.button.id = null;
    }

    dropSettings(){
        this.processor.send(
            APICommands.dropSettings,
            {},
            ()=>{

            }
        );
    }

    getListPorts(callback: Function){
        this.processor.send(
            APICommands.serialPortsList,
            {},
            this.onListOfPorts.bind(this, callback)
        );
    }

    onListOfPorts(callback: Function, response : APIResponse, error: Error){
        if (error === null){
            if (response.code === 0 && response.output instanceof Array){
                typeof callback === 'function' && callback(response.output.map((port)=>{
                    return typeof port === 'object' ? (port !== null ? port.comName : null) : null;
                }).filter((port) => {
                    return typeof port === 'string';
                }));
                return true;
            } else{
                this.showMessage(_('Error'), _('Server returned failed result. Code of error: ') + response.code + _('. Addition data: ') + response.output);
            }
        } else {
            this.showMessage(_('Error'), error.message);
        }
        typeof callback === 'function' && callback(null);
    }

    getFilesInfo(callback: Function){
        this.processor.send(
            APICommands.getFilesDataMonitor,
            {},
            this.onGetFilesInfo.bind(this, callback)
        );
    }

    onGetFilesInfo(callback: Function, response : APIResponse, error: Error){
        if (error === null){
            if (response.code === 0 && typeof response.output === 'object' && response.output !== null && response.output.list !== void 0 && response.output.register !== void 0){
                typeof callback === 'function' && callback(response.output);
                return true;
            } else{
                this.showMessage(_('Error'), _('Server returned failed result. Code of error: ') + response.code + _('. Addition data: ') + response.output);
            }
        } else {
            this.showMessage(_('Error'), error.message);
        }
        typeof callback === 'function' && callback(null);
    }

    getFileContent(file: string, callback: Function) {
        this.processor.send(
            APICommands.getFileContent,
            {
                file: file
            },
            this.onGetFileContent.bind(this, callback)
        );
    }

    getAllFilesContent(callback: Function) {
        this.processor.send(
            APICommands.getAllFilesContent,
            {},
            this.onGetFileContent.bind(this, callback)
        );
    }

    onGetFileContent(callback: Function, response : APIResponse, error: Error){
        if (error === null){
            if (response.code === 0 && typeof response.output === 'object' && response.output !== null && response.output.text !== void 0){
                return typeof callback === 'function' && callback(response.output.text);
            }
        } else {
            this.showMessage(_('Error'), error.message);
        }
        typeof callback === 'function' && callback(null);
    }

    getMatches(reg: boolean, search: Array<string>, callback: Function) {
        this.processor.send(
            APICommands.getMatches,
            {
                reg     : reg,
                search  : search
            },
            this.onGetMatches.bind(this, callback)
        );
    }

    onGetMatches(callback: Function, response : APIResponse, error: Error) {
        if (error === null){
            if (response.code === 0 && typeof response.output === 'object' && response.output !== null && response.output.result !== void 0
                && typeof response.output.result === 'object' && response.output.result !== null){
                return typeof callback === 'function' && callback(response.output.result);
            }
        } else {
            this.showMessage(_('Error'), error.message);
        }
        typeof callback === 'function' && callback(null);
    }

    getStateMonitor(callback: Function){
        this.processor.send(
            APICommands.getStateMonitor,
            {},
            this.onGetStateMonitor.bind(this, callback)
        );
    }

    onGetStateMonitor(callback: Function, response : APIResponse, error: Error){
        if (error === null){
            if (response.code === 0 && typeof response.output === 'object' && response.output !== null && typeof response.output.active === 'boolean' && typeof response.output.port === 'string'){
                this.updateState(response.output);
                return typeof callback === 'function' && callback(response.output);
            }
        } else {
            this.showMessage(_('Error'), error.message);
        }
        this.updateState((new DefaultMonitorState()));
        typeof callback === 'function' && callback(null);
    }

    stopAndClearMonitor(callback: Function){
        this.processor.send(
            APICommands.stopAndClearMonitor,
            {},
            (response : APIResponse, error: Error) => {
                if (error === null){
                    if (response.code === 0){
                        return typeof callback === 'function' && callback(true);
                    }
                } else {
                    this.showMessage(_('Error'), error.message);
                }
                typeof callback === 'function' && callback(false);
            }
        );
    }

    clearLogsOfMonitor(callback: Function){
        this.processor.send(
            APICommands.clearLogsOfMonitor,
            {},
            (response : APIResponse, error: Error) => {
                if (error === null){
                    if (response.code === 0){
                        return typeof callback === 'function' && callback(true);
                    }
                } else {
                    this.showMessage(_('Error'), error.message);
                }
                typeof callback === 'function' && callback(false);
            }
        );
    }

    setSettingsOfMonitor(callback: Function, settings: any){
        this.processor.send(
            APICommands.setSettingsOfMonitor,
            {
                settings: settings
            },
            (response : APIResponse, error: Error) => {
                if (error === null){
                    if (response.code === 0){
                        return typeof callback === 'function' && callback(true);
                    }
                } else {
                    this.showMessage(_('Error'), error.message);
                }
                typeof callback === 'function' && callback(false);
            }
        );
    }

    restartMonitor(callback: Function){
        this.processor.send(
            APICommands.restartMonitor,
            {},
            (response : APIResponse, error: Error) => {
                if (error === null){
                    if (response.code === 0){
                        return typeof callback === 'function' && callback(true);
                    }
                } else {
                    this.showMessage(_('Error'), error.message);
                }
                typeof callback === 'function' && callback(false);
            }
        );
    }

    start(){
        this.showProgress(_('Please wait... Getting list of available ports.'));
        this.getMonitorSettings((settings: MonitorSettings) => {
            this.getListPorts((ports: Array<string>) => {
                ports = ports instanceof Array ? ports : [];
                this.getFilesInfo((info: any) => {
                    info = info !== null ? info : { list: [], register: {} };
                    this.getStateMonitor((state: MonitorState) => {
                        popupController.close(this.progressGUID);
                        state = state !== null ? state : (new DefaultMonitorState());
                        popupController.open({
                            content : {
                                factory     : null,
                                component   : DialogMonitorManager,
                                params      : Object.assign({
                                    ports               : ports,
                                    files               : info.list,
                                    register            : info.register,
                                    state               : state,
                                    getFileContent      : this.getFileContent.bind(this),
                                    getAllFilesContent  : this.getAllFilesContent.bind(this),
                                    getMatches          : this.getMatches.bind(this),
                                    setSettingsOfMonitor: this.setSettingsOfMonitor.bind(this),
                                    stopAndClearMonitor : this.stopAndClearMonitor.bind(this),
                                    restartMonitor      : this.restartMonitor.bind(this),
                                    clearLogsOfMonitor  : this.clearLogsOfMonitor.bind(this),
                                    getStateMonitor     : this.getStateMonitor.bind(this),
                                    getFilesInfo        : this.getFilesInfo.bind(this)
                                }, this.settings)
                            },
                            title   : 'Monitor settings',
                            settings: {
                                move            : true,
                                resize          : true,
                                width           : '40rem',
                                height          : '45rem',
                                close           : true,
                                addCloseHandle  : true,
                                css             : ''
                            },
                            buttons         : [],
                            titlebuttons    : [],
                            GUID            : Symbol()
                        });
                    });
                });
            });
        });
    }

    showMessage(title: string, message: string){
        popupController.open({
            content : {
                factory     : null,
                component   : SimpleText,
                params      : {
                    text: message
                }
            },
            title   : title,
            settings: {
                move            : true,
                resize          : true,
                width           : '20rem',
                height          : '10rem',
                close           : true,
                addCloseHandle  : true,
                css             : ''
            },
            buttons         : [],
            titlebuttons    : [],
            GUID            : Symbol()
        });
    }

    showProgress(caption : string){
        this.progressGUID = Symbol();
        popupController.open({
            content : {
                factory     : null,
                component   : ProgressBarCircle,
                params      : {}
            },
            title   : caption,
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
            GUID            : this.progressGUID
        });
    }

}

const MonitorManager = new OpenMonitorManager();

export { MonitorManager, MonitorState, DefaultMonitorState };
