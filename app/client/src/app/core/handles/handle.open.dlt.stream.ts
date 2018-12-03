import { MenuHandleInterface            } from './handle.interface';
import { popupController                } from '../components/common/popup/controller';
import { ProgressBarCircle              } from '../components/common/progressbar.circle/component';
import { SimpleText                     } from '../components/common/text/simple/component';

import { events as Events               } from '../modules/controller.events';
import { configuration as Configuration } from '../modules/controller.config';

import { APIProcessor                   } from '../api/api.processor';
import { APICommands                    } from '../api/api.commands';
import { APIResponse                    } from '../api/api.response.interface';
import { DialogDltSettings              } from '../components/common/dialogs/dlt.settings/component';
import { localSettings, KEYs            } from '../modules/controller.localsettings';

import StreamService from "./streams.controller";

interface IncomeData{
    addr    : string,
    data    : string
}

export enum EDltLogLevel {
    off = 0,
    fatal = 1,
    error = 2,
    warn = 3,
    info = 4,
    debug = 5,
    verbose = 6
}

export const DltLogLevel = {
    off: 0,
    fatal: 1,
    error: 2,
    warn: 3,
    info: 4,
    debug: 5,
    verbose: 6
}

export interface IDltSettings {
    logLevel: EDltLogLevel; 
}

export interface IDltHistory {
    host: string;
    port: number;
    settings: IDltSettings;
}

interface StreamParameters {
    host        : string,
    port        : number,
    settings    : IDltSettings,
}

export const dltDefaultsSettings: IDltHistory = {
    host: '',
    port: 3490,
    settings: {
        logLevel: EDltLogLevel.warn
    }
}

const STREAM_STATE = {
    WORKING : Symbol(),
    STOPPED : Symbol(),
    PAUSED  : Symbol(),
};

const BUTTONS_ICONS = {
    STOP    : 'fa-stop-circle-o',
    PLAY    : 'fa-play-circle-o',
    PAUSE   : 'fa-pause-circle-o',
};

const BUTTONS_CAPTIONS = {
    STOP    : 'stop stream',
    PLAY    : 'restore stream',
    PAUSE   : 'pause stream',
};

class SettingsController {

    defaults(): IDltHistory {
        return Object.assign({}, dltDefaultsSettings);
    }

    load(): IDltHistory{
        let settings = localSettings.get();
        if (settings !== null && settings[KEYs.dlt] !== void 0 && settings[KEYs.dlt] !== null){
            return settings[KEYs.dlt];
        } else {
            return this.defaults();
        }
    }

    save(history: IDltHistory){
        localSettings.set({
            [KEYs.dlt] : history
        });
    }

}

class DltStream {
    private state       : symbol                = STREAM_STATE.WORKING;
    private buffer      : string                = '';
    private addr        : string                = '';
    private stream      : string                = null;
    private buttons     = {
        STOP        : Symbol(),
        PLAYPAUSE   : Symbol(),
        SETTINGS    : Symbol()
    };

    constructor (addr: string){
        this.addr               = addr;
        this.onData             = this.onData.bind(this);
        this.onClose            = this.onClose.bind(this);
        this.onStop             = this.onStop.bind(this);
        this.onPause            = this.onPause.bind(this);
        this.onStreamReset      = this.onStreamReset.bind(this);
        this.onLostConnection   = this.onLostConnection.bind(this);
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.DESCRIPTION_OF_STREAM_UPDATED,  'DLT stream');
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.TXT_DATA_COME,      '');
        Events.bind(Configuration.sets.SYSTEM_EVENTS.DLT_DEAMON_DATA_COME,  this.onData);
        Events.bind(Configuration.sets.SYSTEM_EVENTS.DLT_DEAMON_CLOSED,     this.onClose);
        Events.bind(Configuration.sets.SYSTEM_EVENTS.TXT_DATA_COME,         this.onStreamReset);
        Events.bind(Configuration.sets.SYSTEM_EVENTS.WS_DISCONNECTED,       this.onLostConnection);
        this.addButtonsInToolBar();
    }

    addButtonsInToolBar(){
        Events.trigger(Configuration.sets.EVENTS_TOOLBAR.ADD_BUTTON, [
            { id : this.buttons.STOP,       icon: BUTTONS_ICONS.STOP,       caption : BUTTONS_CAPTIONS.STOP,        handle: this.onStop,        enable: true},
            { id : this.buttons.PLAYPAUSE,  icon: BUTTONS_ICONS.PAUSE,      caption : BUTTONS_CAPTIONS.PAUSE,       handle: this.onPause,       enable: true},
        ]);
    }

    destroy(){
        //Unbind events
        Events.unbind(Configuration.sets.SYSTEM_EVENTS.DLT_DEAMON_DATA_COME,    this.onData);
        Events.unbind(Configuration.sets.SYSTEM_EVENTS.DLT_DEAMON_CLOSED,       this.onClose);
        Events.unbind(Configuration.sets.SYSTEM_EVENTS.TXT_DATA_COME,           this.onStreamReset);
        Events.unbind(Configuration.sets.SYSTEM_EVENTS.WS_DISCONNECTED,         this.onLostConnection);
        //Kill buttons
        Object.keys(this.buttons).forEach((button)=>{
            Events.trigger(Configuration.sets.EVENTS_TOOLBAR.REMOVE_BUTTON, this.buttons[button]);
        });
        //Reset titles
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.DESCRIPTION_OF_STREAM_UPDATED, _('No active stream or file opened'));
        //Reset service
        StreamService.reset();
    }

    onClose(params : IncomeData){
        if (this.addr === params.addr){
            this.onStopped(null);
        }
    }

    onStop(){
        if (this.state !== STREAM_STATE.STOPPED){
            let processor   = APIProcessor;
            this.state      = STREAM_STATE.STOPPED;
            processor.send(
                APICommands.disconnectDltDaemon,
                {
                    addr: this.addr
                },
                this.onStopped.bind(this)
            );
        }
    }

    onStopped(response : APIResponse){
        this.destroy();
    }

    onPause(){
        let alias = null;
        switch (this.state){
            case STREAM_STATE.WORKING:
                this.state  = STREAM_STATE.PAUSED;
                alias       = 'PLAY';
                break;
            case STREAM_STATE.PAUSED:
                this.state  = STREAM_STATE.WORKING;
                alias       = 'PAUSE';
                this.onData({
                    addr : this.addr,
                    data : ''
                });
                break;
        }
        alias !== null && Events.trigger(Configuration.sets.EVENTS_TOOLBAR.UPDATE_BUTTON, {
            id      : this.buttons.PLAYPAUSE,
            icon    : BUTTONS_ICONS     [alias],
            caption : BUTTONS_CAPTIONS  [alias]
        });
    }

    onStreamReset(){
        this.onStop();
    }

    onData(params : IncomeData){
        if (this.addr === params.addr){
            switch (this.state){
                case STREAM_STATE.WORKING:
                    this.buffer += params.data;
                    Events.trigger(Configuration.sets.SYSTEM_EVENTS.STREAM_DATA_UPDATE, this.buffer);
                    this.buffer = '';
                    break;
                case STREAM_STATE.PAUSED:
                    this.buffer += params.data;
                    break;
                case STREAM_STATE.STOPPED:
                    break;
            }
        }
    }

    onLostConnection(){
        this.destroy();
    }

    close(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.state === STREAM_STATE.STOPPED){
                return resolve();
            }
            let processor   = APIProcessor;
            this.state      = STREAM_STATE.STOPPED;
            processor.send(
                APICommands.disconnectDltDaemon,
                {
                    addr: this.addr
                },
                () => {
                    this.destroy();
                    return resolve();
                }
            );
        });
    }

}

class OpenDLTStream implements MenuHandleInterface{
    private progressGUID    : symbol                = Symbol();
    private processor       : any                   = APIProcessor;
    private stream          : DltStream             = null;
    private settings        : SettingsController    = new SettingsController();

    constructor(){

    }

    start(){
        StreamService.register({
            name: `DLT deamon listener`,
            closer: () => {
                return new Promise((resolve, reject) =>{
                    if (this.stream === null) {
                        return resolve();
                    }
                    this.stream.close().then(() => {
                        this.stream = null;
                        return resolve();
                    }).catch((error) => {
                        this.showMessage(`Something goes wrong.`, error.message);
                        return reject();
                    });
                });
            }
        }).then(() => {
            this.showOpen();
        }).catch(() => {
            // Do nothing
        });
    }

    openStream(params: StreamParameters){
        this.showProgress(_('Please wait... Opening...'));
        this.closeStream();
        this.processor.send(
            APICommands.connectToDltDaemon,
            {
                host        : params.host,
                port        : params.port,
                settings    : params.settings,
            },
            this.onStreamOpened.bind(this, params)
        );
    }

    onStreamOpened(params: IDltHistory, response : APIResponse, error: Error){
        this.hidePopup(this.progressGUID);
        if (error === null){
            if (response.code === 0 && typeof response.output === 'string'){
                this.attachStream(response.output);
                this.settings.save(params);
            } else{
                this.showMessage(_('Error'), _('Server returned failed result. Code of error: ') + response.code + _('. Addition data: ') + this.outputToString(response.output));
            }
        } else {
            this.showMessage(_('Error'), error.message);
        }
    }

    closeStream(){
        if (this.stream !== null) {
            this.stream.onStop();
            this.stream = null;
            //Reset service
            StreamService.reset();
        }
    }

    attachStream(addr: string){
        this.stream = new DltStream(addr);
    }

    outputToString(output: any){
        if (typeof output === 'string') {
            return output;
        } else if (typeof output === 'number'){
            return output.toString();
        } else if (typeof output === 'object'){
            return JSON.stringify(output);
        }
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

    showOpen(){
        let GUID = Symbol();
        const lastSettings: IDltHistory = this.settings.load();
        popupController.open({
            content : {
                factory     : null,
                component   : DialogDltSettings,
                params      : {
                    host    : lastSettings.host,
                    port    : lastSettings.port,
                    settings: lastSettings.settings,
                    proceed : this.onApplyOpen.bind(this, GUID),
                    cancel  : this.onCancelOpen.bind(this, GUID)
                }
            },
            title   : _('Connection to DLT deamon: '),
            settings: {
                move            : true,
                resize          : true,
                width           : '40rem',
                height          : '20rem',
                close           : true,
                addCloseHandle  : true,
                css             : ''
            },
            buttons         : [],
            titlebuttons    : [],
            GUID            : GUID
        });
    }

    onApplyOpen(GUID: symbol, data: IDltHistory){
        this.hidePopup(GUID);
        let params : StreamParameters = {
            host        : data.host,
            port        : data.port,
            settings    : data.settings,
        };
        this.openStream(params);
    }

    onCancelOpen(GUID: symbol){
        this.hidePopup(GUID);
        //Reset service
        StreamService.reset();
    }

    hidePopup(GUID: symbol){
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.REMOVE_FROM_ROOT_HOLDER, GUID);
    }

}

export { OpenDLTStream };
