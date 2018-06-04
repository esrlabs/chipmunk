import { MenuHandleInterface            } from './handle.interface';
import { popupController                } from '../components/common/popup/controller';
import { ProgressBarCircle              } from '../components/common/progressbar.circle/component';
import { SimpleText                     } from '../components/common/text/simple/component';

import { events as Events               } from '../modules/controller.events';
import { configuration as Configuration } from '../modules/controller.config';

import { APIProcessor                   } from '../api/api.processor';
import { APICommands                    } from '../api/api.commands';
import { APIResponse                    } from '../api/api.response.interface';
import { DialogADBLogcatStreamSettings  } from '../components/common/dialogs/adblogcat.settings/component';
import { DialogMessage                  } from '../components/common/dialogs/dialog-message/component';
import { DialogMessageList              } from '../components/common/dialogs/dialog-message-list/component';
import { ANSIClearer                    } from '../modules/tools.ansiclear';


import { localSettings, KEYs            } from '../../core/modules/controller.localsettings';
import set = Reflect.set;

interface Entry {
    date    : number,
    pid     : string,
    tid     : string,
    tag     : string,
    message : string,
    original: string
}

interface IncomeData{
    stream  : string,
    entries : Array<Entry>
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
    SETTINGS: 'fa-gear'
};

const BUTTONS_CAPTIONS = {
    STOP    : 'stop stream',
    PLAY    : 'restore stream',
    PAUSE   : 'pause stream',
    SETTINGS: 'settings of stream'
};

const ERRORS = {
    ADB_SPAWN_01: 'ADB_SPAWN_01'
};

interface ADBFilter{
    value: string,
    level: string
}

const DEFAULT_STREAM_SETTINGS : {
    filters : Array<ADBFilter>,
    path    : string,
    custom  : string,
    reset   : boolean
} = {
    filters : [],
    path    : '',
    custom  : '',
    reset   : false
};

interface LogcatStreamSettings {
    filters     : Array<ADBFilter>,
    path        : string,
    custom      : string,
    reset       : boolean,
    deviceID?   : string
}

interface DeviceDescription {
    ID: string,
    model: string,
    device: string,
    usb: string,
    product: string
}

class SettingsController{

    defaults(): LogcatStreamSettings{
        return Object.assign({}, DEFAULT_STREAM_SETTINGS);
    }

    load(): LogcatStreamSettings{
        let settings = localSettings.get();
        if (settings !== null && settings[KEYs.adblogccat_stream] !== void 0 && settings[KEYs.adblogccat_stream] !== null){
            return Object.assign({}, this.verify(settings[KEYs.adblogccat_stream], this.defaults()));
        } else {
            return this.defaults();
        }
    }

    save(settings: LogcatStreamSettings){
        if (typeof settings === 'object' && settings !== null){
            localSettings.set({
                [KEYs.adblogccat_stream] : settings
            });
        }
    }

    verify(settings: any, defaults: any){
        Object.keys(defaults).forEach((key: string) => {
            if (typeof defaults[key] !== typeof settings[key]) {
                settings[key] = defaults[key];
            }
            if (typeof settings[key] === 'object' && settings[key] !== null && !(settings[key] instanceof Array)){
                settings[key] = this.verify(settings[key], defaults[key]);
            }
        });
        return settings;
    }

    convert(settings: LogcatStreamSettings): LogcatStreamSettings {
        const _settings = {
            filters : settings.filters !== void 0 ? settings.filters : [],
            path    : settings.path !== void 0 ? settings.path : '',
            reset   : settings.reset !== void 0 ? settings.reset : false,
            custom  : settings.custom !== void 0 ? settings.custom : '',
        } as LogcatStreamSettings;
        if (typeof settings.deviceID === 'string' && settings.deviceID.trim() !== ''){
            _settings.deviceID = settings.deviceID;
        }
        return _settings;
    }
}

class LogcatStream {
    private Settings    : SettingsController    = new SettingsController();
    private processor   : any                   = APIProcessor;
    private state       : symbol                = STREAM_STATE.WORKING;
    private buffer      : string                = '';
    private stream      : string                = null;
    private buttons     = {
        STOP        : Symbol(),
        PLAYPAUSE   : Symbol(),
        SETTINGS    : Symbol()
    };

    constructor (stream: string){
        this.stream             = stream;
        this.onData             = this.onData.bind(this);
        this.onStop             = this.onStop.bind(this);
        this.onPause            = this.onPause.bind(this);
        this.onStreamReset      = this.onStreamReset.bind(this);
        this.onLostConnection   = this.onLostConnection.bind(this);
        this.onSettings         = this.onSettings.bind(this);
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.DESCRIPTION_OF_STREAM_UPDATED,  'ADB Logcat');
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.TXT_DATA_COME,                  '');
        Events.bind(Configuration.sets.SYSTEM_EVENTS.ADB_LOGCAT_DATA_COME,              this.onData);
        Events.bind(Configuration.sets.SYSTEM_EVENTS.TXT_DATA_COME,                     this.onStreamReset);
        Events.bind(Configuration.sets.SYSTEM_EVENTS.WS_DISCONNECTED,                   this.onLostConnection);
        this.addButtonsInToolBar();
    }

    addButtonsInToolBar(){
        Events.trigger(Configuration.sets.EVENTS_TOOLBAR.ADD_BUTTON, [
            { id : this.buttons.STOP,       icon: BUTTONS_ICONS.STOP,       caption : BUTTONS_CAPTIONS.STOP,        handle: this.onStop,        enable: true},
            { id : this.buttons.PLAYPAUSE,  icon: BUTTONS_ICONS.PAUSE,      caption : BUTTONS_CAPTIONS.PAUSE,       handle: this.onPause,       enable: true},
            { id : this.buttons.SETTINGS,   icon: BUTTONS_ICONS.SETTINGS,   caption : BUTTONS_CAPTIONS.SETTINGS,    handle: this.onSettings,    enable: true},
        ]);
    }

    destroy(){
        //Unbind events
        Events.unbind(Configuration.sets.SYSTEM_EVENTS.ADB_LOGCAT_DATA_COME,    this.onData);
        Events.unbind(Configuration.sets.SYSTEM_EVENTS.TXT_DATA_COME,           this.onStreamReset);
        Events.unbind(Configuration.sets.SYSTEM_EVENTS.WS_DISCONNECTED,         this.onLostConnection);
        //Kill buttons
        Object.keys(this.buttons).forEach((button)=>{
            Events.trigger(Configuration.sets.EVENTS_TOOLBAR.REMOVE_BUTTON, this.buttons[button]);
        });
        //Reset titles
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.DESCRIPTION_OF_STREAM_UPDATED, _('No active stream or file opened'));
    }

    onStop(){
        if (this.state !== STREAM_STATE.STOPPED){
            let processor   = APIProcessor;
            this.state      = STREAM_STATE.STOPPED;
            processor.send(
                APICommands.closeLogcatStream,
                {
                    stream      : this.stream
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
                    stream  : this.stream,
                    entries : []
                });
                break;
        }
        alias !== null && Events.trigger(Configuration.sets.EVENTS_TOOLBAR.UPDATE_BUTTON, {
            id      : this.buttons.PLAYPAUSE,
            icon    : BUTTONS_ICONS     [alias],
            caption : BUTTONS_CAPTIONS  [alias]
        });
    }

    onSettings(){
        let GUID        = Symbol();
        let settings    = this.Settings.load();
        let params      = Object.assign({}, settings) as any;
        params.filters  = settings.filters;
        params.path     = settings.path;
        params.reset    = settings.reset;
        params.custom   = settings.custom;
        params.proceed  = this.onApplySettings.bind(this, GUID);
        params.cancel   = this.onCancelSettings.bind(this, GUID);
        popupController.open({
            content : {
                factory     : null,
                component   : DialogADBLogcatStreamSettings,
                params      : params
            },
            title   : _('Configuration of ADB logcat stream: '),
            settings: {
                move            : true,
                resize          : true,
                width           : '40rem',
                height          : '40rem',
                close           : true,
                addCloseHandle  : true,
                css             : ''
            },
            buttons         : [],
            titlebuttons    : [],
            GUID            : GUID
        });
    }

    onApplySettings(GUID: symbol, settings: LogcatStreamSettings){
        this.Settings.save(settings);
        this.applySettings(this.Settings.convert(settings));
        this.hidePopup(GUID);
    }

    applySettings(settings: LogcatStreamSettings){
        this.processor.send(
            APICommands.setSettingsLogcatStream,
            {
                settings : settings
            },
            ()=>{
            }
        );
    }

    onCancelSettings(GUID: symbol){
        this.hidePopup(GUID);
    }

    hidePopup(GUID: symbol){
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.REMOVE_FROM_ROOT_HOLDER, GUID);
    }

    onStreamReset(){
        this.onStop();
    }

    onData(params : IncomeData){
        if (this.stream === params.stream){
            switch (this.state){
                case STREAM_STATE.WORKING:
                    this.buffer += params.entries.map((entry) => { return entry.original;}).join('\n') + '\n';
                    Events.trigger(Configuration.sets.SYSTEM_EVENTS.STREAM_DATA_UPDATE, this.buffer);
                    this.buffer = '';
                    break;
                case STREAM_STATE.PAUSED:
                    this.buffer += params.entries.map((entry) => { return entry.original;}).join('\n');
                    break;
                case STREAM_STATE.STOPPED:
                    break;
            }
        }
    }

    onLostConnection(){
        this.destroy();
    }

}

class OpenADBLogcatStream implements MenuHandleInterface{
    private progressGUID    : symbol                = Symbol();
    private processor       : any                   = APIProcessor;
    private listening       : boolean               = false;
    private Settings        : SettingsController    = new SettingsController();
    private activeDevice    : string | null         = null;

    constructor(){

    }

    setActiveDevice(deviceID: string){
        this.activeDevice = deviceID;
    }

    start(){
        this.setActiveDevice(null);
        this.openStream();
    }

    setupAndOpen(){
        this.showSettings();
    }

    setupSettings(){
        this.showSettings(true);
    }

    getDevicesList(): Promise<Array<DeviceDescription>> {
        return new Promise((resolve, reject) => {
            let settings = this.Settings.load();
            this.processor.send(
                APICommands.getADBDevicesList,
                {
                    settings : this.Settings.convert(settings)
                },
                (devices: APIResponse) => {
                    if (devices.code !== 0 || !(devices.output instanceof Array)){
                        return reject(new Error(`Cannot get devices list. Please try again.`));
                    }
                    resolve(devices.output);
                }
            );
        });
    }

    openStream(deviceID?: string){
        if (typeof deviceID === 'string' && deviceID.trim() !== ''){
            this.setActiveDevice(deviceID);
        }
        if (this.activeDevice === null) {
            return this.getDevicesList()
                .then((devices: Array<DeviceDescription>) => {
                    if (devices.length === 0) {
                        return this.showMessage('No devices', 'No connected / authorized devices found');
                    }
                    if (devices.length > 1){
                        return this.showDevicesList(devices);
                    }
                    this.setActiveDevice(devices[0].ID);
                    this.openStream();
                })
                .catch((error) => {
                    this.showMessage('Error', error.message);
                });
        }
        this.showProgress(_('Please wait... Opening...'));
        let settings = this.Settings.load();
        this.processor.send(
            APICommands.openLogcatStream,
            {
                settings : this.Settings.convert(Object.assign({
                    deviceID: this.activeDevice
                }, settings))
            },
            this.onStreamOpened.bind(this)
        );
    }

    onStreamOpened(response : APIResponse, error: Error){
        this.hidePopup(this.progressGUID);
        if (error === null){
            if (response.code === 0 && typeof response.output === 'string'){
                //Everything is cool.
                this.listening = true;
                this.attachStream(response.output);
            } else{
                if (~response.output.indexOf(ERRORS.ADB_SPAWN_01)){
                    this.showPromptToSettings();
                } else {
                    this.showMessage(_('Error'), _('Server returned failed result. Code of error: ') + response.code + _('. Addition data: ') + this.outputToString(response.output));
                }
            }
        } else {
            this.showMessage(_('Error'), error.message);
        }
    }

    attachStream(stream: string){
        let logcatStream = new LogcatStream(stream);
    }

    outputToString(output: any){
        if (typeof output === 'string') {
            return ANSIClearer(output);
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

    showDevicesList(devices: Array<DeviceDescription>){
        const popupGUID = Symbol();
        popupController.open({
            content : {
                factory     : null,
                component   : DialogMessageList,
                params      : {
                    message: `Several devices are detected. Please choose to connect.`,
                    list: devices.map((device: DeviceDescription) => {
                        return {
                            caption: `device: ${device.device}; model: ${device.model}; product: ${device.product}; usb: ${device.usb}`,
                            handle: () => {
                                popupController.close(popupGUID);
                                this.openStream(device.ID);
                            }
                        }
                    })
                }
            },
            title   : 'Devices list',
            settings: {
                move            : true,
                resize          : true,
                width           : '50rem',
                height          : '15rem',
                close           : true,
                addCloseHandle  : true,
                css             : ''
            },
            buttons         : [],
            titlebuttons    : [],
            GUID            : popupGUID
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

    showPromptToSettings(){
        let guid = Symbol();
        popupController.open({
            content : {
                factory     : null,
                component   : DialogMessage,
                params      : {
                    message: 'It looks like LogViewer cannot find adb SDK. You can open settings of ADB Logcat and define direct path to adb SDK. Be sure, that you have installed adb SDK on your system.',
                    buttons: [
                        {
                            caption: 'Open settings',
                            handle : this.showSettings.bind(this, guid)
                        },
                        {
                            caption: 'Close',
                            handle : ()=>{
                                this.hidePopup(guid);
                            }
                        }
                    ]
                }
            },
            title   : 'Cannot find adb SDK',
            settings: {
                move            : true,
                resize          : true,
                width           : '30rem',
                height          : '15rem',
                close           : true,
                addCloseHandle  : true,
                css             : ''
            },
            buttons         : [],
            titlebuttons    : [],
            GUID            : guid
        });
    }

    showSettings(onlySave: boolean = false){
        let GUID        = Symbol();
        let settings    = this.Settings.load();
        let params      = Object.assign({}, settings) as any;
        params.filters  = settings.filters;
        params.path     = settings.path;
        params.reset    = settings.reset;
        params.custom   = settings.custom;
        params.proceed  = onlySave ? this.onSaveSettings.bind(this, GUID) : this.onApplySettings.bind(this, GUID);
        params.cancel   = this.onCancelSettings.bind(this, GUID);
        popupController.open({
            content : {
                factory     : null,
                component   : DialogADBLogcatStreamSettings,
                params      : params
            },
            title   : _('Configuration of ADB logcat stream: '),
            settings: {
                move            : true,
                resize          : true,
                width           : '40rem',
                height          : '40rem',
                close           : true,
                addCloseHandle  : true,
                css             : ''
            },
            buttons         : [],
            titlebuttons    : [],
            GUID            : GUID
        });
    }

    onSaveSettings(GUID: symbol, settings: LogcatStreamSettings){
        this.Settings.save(settings);
        this.hidePopup(GUID);
    }

    onApplySettings(GUID: symbol, settings: LogcatStreamSettings){
        this.Settings.save(settings);
        this.openStream();
        this.hidePopup(GUID);
    }

    onCancelSettings(GUID: symbol){
        this.hidePopup(GUID);
    }

    hidePopup(GUID: symbol){
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.REMOVE_FROM_ROOT_HOLDER, GUID);
    }

}

export { OpenADBLogcatStream };
