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

import { localSettings, KEYs            } from '../../core/modules/controller.localsettings';

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

const DEFAULT_STREAM_SETTINGS = {
    levels : {
        V: true,
        I: true,
        F: true,
        W: true,
        E: true,
        D: true,
        S: true
    },
    tid: -1,
    pid: -1
};

interface LocalLevelsSettings {
    V: boolean,
    I: boolean,
    W: boolean,
    E: boolean,
    D: boolean,
    S: boolean,
    F: boolean,
}

interface LocalSettings {
    levels  : LocalLevelsSettings,
    tid     : number,
    pid     : number
}

interface LogcatStreamSettings {
    pid : string,
    tid : string,
    tags: Array<string>
}

class SettingsController{

    defaults(): LocalSettings{
        return Object.assign({}, DEFAULT_STREAM_SETTINGS);
    }

    load(): LocalSettings{
        let settings = localSettings.get();
        if (settings !== null && settings[KEYs.adblogccat_stream] !== void 0 && settings[KEYs.adblogccat_stream] !== null){
            return Object.assign({}, settings[KEYs.adblogccat_stream]);
        } else {
            return this.defaults();
        }
    }

    save(settings: LocalSettings){
        if (typeof settings === 'object' && settings !== null){
            localSettings.set({
                [KEYs.adblogccat_stream] : settings
            });
        }
    }

    convert(settings: LocalSettings): LogcatStreamSettings {
        let tags: Array<string> = [];
        ['V', 'I', 'E', 'D', 'F', 'S', 'W'].forEach((key)=>{
            settings.levels[key] && tags.push(key);
        });
        return {
            pid : settings.pid > 0 ? settings.pid.toString() : '',
            tid : settings.tid > 0 ? settings.tid.toString() : '',
            tags: tags.length === 7 ? null : tags
        }
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
        this.applyDefaultSettings();
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
        let params      = Object.assign({}, settings.levels) as any;
        params.tid      = settings.tid;
        params.pid      = settings.pid
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
                height          : '35rem',
                close           : true,
                addCloseHandle  : true,
                css             : ''
            },
            buttons         : [],
            titlebuttons    : [],
            GUID            : GUID
        });
    }

    onApplySettings(GUID: symbol, settings: LocalSettings){
        this.Settings.save(settings);
        this.applySettings(this.Settings.convert(settings));
        this.hidePopup(GUID);
    }

    applyDefaultSettings(){
        let settings = this.Settings.load();
        this.applySettings(this.Settings.convert(settings));
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
                    this.buffer += params.entries.map((entry) => { return entry.original;}).join('\n');
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
    private GUID            : symbol        = Symbol();
    private progressGUID    : symbol        = Symbol();
    private processor       : any           = APIProcessor;
    private listening       : boolean       = false;

    constructor(){
    }

    start(){
        this.openStream();
    }

    openStream(){
        this.showProgress(_('Please wait... Opening...'));
        this.processor.send(
            APICommands.openLogcatStream,
            {
                settings : null
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
                this.showMessage(_('Error'), _('Server returned failed result. Code of error: ') + response.code + _('. Addition data: ') + this.outputToString(response.output));
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

    hidePopup(GUID: symbol){
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.REMOVE_FROM_ROOT_HOLDER, GUID);
    }

}

export { OpenADBLogcatStream };
