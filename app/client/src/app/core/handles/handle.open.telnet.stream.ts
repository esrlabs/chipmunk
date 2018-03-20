import { MenuHandleInterface            } from './handle.interface';
import { popupController                } from '../components/common/popup/controller';
import { ProgressBarCircle              } from '../components/common/progressbar.circle/component';
import { SimpleText                     } from '../components/common/text/simple/component';
import { DialogTelnetSettings           } from '../components/common/dialogs/telnet.settings/component';
import { DialogMessageList              } from '../components/common/dialogs/dialog-message-list/component';

import { events as Events               } from '../modules/controller.events';
import { configuration as Configuration } from '../modules/controller.config';

import { APIProcessor                   } from '../api/api.processor';
import { APICommands                    } from '../api/api.commands';
import { APIResponse                    } from '../api/api.response.interface';

import { TelnetSedingPackage            } from '../interfaces/interface.telnet.send.package';
import { localSettings, KEYs            } from '../../core/modules/controller.localsettings';

import { ExtraButton, BarAPI            } from '../../views/search.results/search.request/interface.extrabutton';
import { GUID                           } from '../../core/modules/tools.guid';

interface IncomeData{
    connection  : string,
    data        : string
}

const STREAM_STATE = {
    WORKING : Symbol(),
    STOPPED : Symbol(),
    PAUSED  : Symbol()
};

const BUTTONS_ICONS = {
    STOP    : 'fa-stop-circle-o',
    PLAY    : 'fa-play-circle-o',
    PAUSE   : 'fa-pause-circle-o'
};

const BUTTONS_CAPTIONS = {
    STOP    : 'stop stream',
    PLAY    : 'restore stream',
    PAUSE   : 'pause stream',
};

const DEFAULT_TELNET_SETTINGS = {
    host                : '127.0.0.1',
    port                : 23,
    timeout             : 30000,
    shellPrompt         : '',
    loginPrompt         : '',
    passwordPrompt      : '',
    failedLoginMatch    : '',
    initialLFCR         : false,
    username            : 'root',
    password            : 'guest',
    irs                 : '\r\n',
    ors                 : '\n',
    echoLines           : 1,
    stripShellPrompt    : true,
    pageSeparator       : '---- More',
    negotiationMandatory: true,
    execTimeout         : 2000,
    sendTimeout         : 2000,
    maxBufferLength     : 1 * 1024 * 1024,
    debug               : false
};

class SettingsController{

    defaults(){
        return Object.assign({}, DEFAULT_TELNET_SETTINGS);
    }

    load(alias: string){
        let settings = localSettings.get();
        if (settings !== null && settings[KEYs.telnet] !== void 0 && settings[KEYs.telnet] !== null && settings[KEYs.telnet][alias] !== void 0){
            return Object.assign({}, settings[KEYs.telnet][alias]);
        } else {
            return this.defaults();
        }
    }

    save(alias: string, settings: Object){
        if (typeof settings === 'object' && settings !== null){
            localSettings.set({
                [KEYs.telnet] : {
                    [alias] : settings
                }
            });
        }
    }

    getAliases(){
        let settings = localSettings.get();
        let results: Array<string> = [];
        if (settings !== null && settings[KEYs.telnet] !== void 0 && settings[KEYs.telnet] !== null ){
            results = Object.keys(settings[KEYs.telnet]);
        }
        return results;
    }

    getAlias(settings: any){
        return settings.host + ':' + settings.port;
    }

    clear(){
        localSettings.reset(KEYs.telnet, 'Dropping history of telnet connections');
    }
}

class TelnetSender{

    private ID: symbol = Symbol();
    private barAPI : BarAPI = null;
    private message: string = '';
    private packageGUID: string = null;
    private history: Array<string> = [];
    private historyCursor: number = -1;

    constructor(){
        Events.bind(Configuration.sets.SYSTEM_EVENTS.DATA_TO_TELNET_SENT, this.onDATA_TO_TELNET_SENT.bind(this));
    }

    addButton(){
        Events.trigger(Configuration.sets.EVENTS_VIEWS.VIEW_SEARCH_RESULTS_BUTTON_ADD, {
            id          : this.ID,
            title       : 'Send data to telnet',
            icon        : 'fa-keyboard-o',
            active      : false,
            onKeyUp     : this.onKeyUp.bind(this),
            onEnter     : this.onEnter.bind(this),
            placeholder : 'type command for telnet'
        } as ExtraButton, (api: BarAPI) => {
            this.barAPI = api;
        });

    }

    removeButton(){
        Events.trigger(Configuration.sets.EVENTS_VIEWS.VIEW_SEARCH_RESULTS_BUTTON_REMOVE, this.ID);
        this.barAPI = null;
    }

    onKeyUp(event: KeyboardEvent, value: string){
        if (this.barAPI === null || this.history.length === 0){
            return false;
        }
        switch (event.keyCode){
            case 38:
                this.historyCursor += 1;
                if (this.historyCursor > (this.history.length - 1)) {
                    this.historyCursor = this.history.length - 1;
                }
                this.history[this.historyCursor] !== void 0 && this.barAPI.setValue(this.history[this.historyCursor]);
                break;
            case 40:
                this.historyCursor -= 1;
                if (this.historyCursor < 0) {
                    this.historyCursor = 0;
                }
                this.history[this.historyCursor] !== void 0 && this.barAPI.setValue(this.history[this.historyCursor]);
                break;
        }
    }

    onEnter(event: KeyboardEvent, value: string){
        this.message = value;
        this.send();
    }

    send(){
        this.barAPI !== null && this.barAPI.showProgress();
        this.packageGUID = GUID.generate();
        this.history.unshift(this.message);
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.READY_TO_SEND_DATA_TO_TELNET, {
            packageGUID : this.packageGUID,
            buffer      : this.message + '\n\r' + ' ',
        } as TelnetSedingPackage);
    }

    onDATA_TO_TELNET_SENT(params: any){
        if (params.packageGUID === this.packageGUID){
            this.barAPI !== null && this.barAPI.hideProgress();
            this.packageGUID = null;
            this.barAPI.setValue('');
        }
    }
}

class TelnetStream{
    private connection  : string            = null;
    private alias       : string            = null;
    private state       : symbol            = STREAM_STATE.WORKING;
    private buffer      : string            = '';
    private sender      : TelnetSender      = new TelnetSender();
    private buttons     = {
        STOP        : Symbol(),
        PLAYPAUSE   : Symbol()
    };

    constructor(connection: string, alias: string){
        this.connection             = connection;
        this.alias                  = alias;
        this.onData                 = this.onData.bind(this);
        this.onStop                 = this.onStop.bind(this);
        this.onPause                = this.onPause.bind(this);
        this.onStreamReset          = this.onStreamReset.bind(this);
        this.onLostConnection       = this.onLostConnection.bind(this);
        this.onReadyToSendData      = this.onReadyToSendData.bind(this);
        this.onConnectionIsClosed   = this.onConnectionIsClosed.bind(this);
        this.addButtonsInToolBar();
        this.sender.addButton();
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.DESCRIPTION_OF_STREAM_UPDATED,  this.alias);
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.TXT_DATA_COME,                  '');
        Events.bind(Configuration.sets.SYSTEM_EVENTS.READY_TO_SEND_DATA_TO_TELNET,      this.onReadyToSendData);
        Events.bind(Configuration.sets.SYSTEM_EVENTS.TELNET_DATA_COME,                  this.onData);
        Events.bind(Configuration.sets.SYSTEM_EVENTS.TXT_DATA_COME,                     this.onStreamReset);
        Events.bind(Configuration.sets.SYSTEM_EVENTS.WS_DISCONNECTED,                   this.onLostConnection);
        Events.bind(Configuration.sets.SYSTEM_EVENTS.TELNET_CONNECTION_CLOSED,          this.onConnectionIsClosed);
    }

    addButtonsInToolBar(){
        Events.trigger(Configuration.sets.EVENTS_TOOLBAR.ADD_BUTTON, [
            { id : this.buttons.STOP,       icon: BUTTONS_ICONS.STOP,   caption : BUTTONS_CAPTIONS.STOP,    handle: this.onStop,    enable: true},
            { id : this.buttons.PLAYPAUSE,  icon: BUTTONS_ICONS.PAUSE,  caption : BUTTONS_CAPTIONS.PAUSE,   handle: this.onPause,   enable: true},
        ]);
    }

    destroy(){
        //Unbind events
        Events.unbind(Configuration.sets.SYSTEM_EVENTS.TELNET_DATA_COME,                this.onData);
        Events.unbind(Configuration.sets.SYSTEM_EVENTS.TXT_DATA_COME,                   this.onStreamReset);
        Events.unbind(Configuration.sets.SYSTEM_EVENTS.WS_DISCONNECTED,                 this.onLostConnection);
        Events.unbind(Configuration.sets.SYSTEM_EVENTS.READY_TO_SEND_DATA_TO_TELNET,    this.onReadyToSendData);
        Events.unbind(Configuration.sets.SYSTEM_EVENTS.TELNET_CONNECTION_CLOSED,        this.onConnectionIsClosed);
        //Kill buttons
        Object.keys(this.buttons).forEach((button)=>{
            Events.trigger(Configuration.sets.EVENTS_TOOLBAR.REMOVE_BUTTON, this.buttons[button]);
        });
        //Reset titles
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.DESCRIPTION_OF_STREAM_UPDATED, _('No active stream or file opened'));
        this.sender.removeButton();
    }

    onStreamReset(){
        this.onStop();
    }

    onStop(){
        if (this.state !== STREAM_STATE.STOPPED){
            let processor   = APIProcessor;
            this.state      = STREAM_STATE.STOPPED;
            processor.send(
                APICommands.closeTelnetStream,
                {
                    alias       : this.alias,
                    connection  : this.connection
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
                    connection  : this.connection,
                    data        : ''
                });
                break;
        }
        alias !== null && Events.trigger(Configuration.sets.EVENTS_TOOLBAR.UPDATE_BUTTON, {
            id      : this.buttons.PLAYPAUSE,
            icon    : BUTTONS_ICONS     [alias],
            caption : BUTTONS_CAPTIONS  [alias]
        });
    }

    onData(params : IncomeData){
        if (this.connection === params.connection){
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

    onConnectionIsClosed(params: { connection: string}){
        if (this.connection === params.connection){
            this.destroy();
        }
    }

    onReadyToSendData(params: TelnetSedingPackage){
        if (params.packageGUID !== void 0 && params.buffer !== void 0){
            Events.trigger(Configuration.sets.SYSTEM_EVENTS.SEND_DATA_TO_TELNET, {
                packageGUID : params.packageGUID,
                alias       : this.alias,
                streamGUID  : this.connection,
                buffer      : params.buffer
            });
        }
    }

    onLostConnection(){
        this.destroy();
    }
}

class OpenTelnetStream implements MenuHandleInterface{
    private GUID            : symbol                = Symbol();
    private progressGUID    : symbol                = Symbol();
    private processor       : any                   = APIProcessor;
    private alias           : string                = null;
    private connection      : string                = null;
    private telnetStream    : TelnetStream          = null;
    private Settings        : SettingsController    = new SettingsController();

    constructor(){
    }

    start(){
        const aliases = this.Settings.getAliases();
        if (aliases.length > 0) {
            let GUID = Symbol();
            popupController.open({
                content : {
                    factory     : null,
                    component   : DialogMessageList,
                    params      : {
                        message: `You have saved telnet connection. You can select it from your history:`,
                        list   : aliases.map((alias: string) => {
                            return {
                                caption : alias,
                                handle  : ()=>{
                                    this.showSettings(this.Settings.load(alias));
                                    popupController.close(GUID);
                                }
                            }
                        }),
                        buttons: [
                            {
                                caption: 'New',
                                handle : ()=>{
                                    this.showSettings(DEFAULT_TELNET_SETTINGS);
                                    popupController.close(GUID);
                                }
                            },
                            {
                                caption: 'Clear All and Open New',
                                handle : ()=>{
                                    this.Settings.clear();
                                    this.showSettings(DEFAULT_TELNET_SETTINGS);
                                    popupController.close(GUID);
                                }
                            },
                            {
                                caption: 'Cancel',
                                handle : ()=>{
                                    popupController.close(GUID);
                                }
                            }
                        ]
                    }
                },
                title   : _('History of telnet connections'),
                settings: {
                    move            : true,
                    resize          : true,
                    width           : '30rem',
                    height          : '25rem',
                    close           : true,
                    addCloseHandle  : true,
                    css             : ''
                },
                buttons         : [],
                titlebuttons    : [],
                GUID            : GUID
            });
        } else {
            this.showSettings(DEFAULT_TELNET_SETTINGS);
        }
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

    openTelnetStream(alias: string, settings: Object){
        this.closeTelnetStream();
        this.showProgress(_('Please wait... Opening ') + alias);
        this.alias = alias;
        this.processor.send(
            APICommands.openTelnetStream,
            {
                alias       : alias,
                settings    : settings
            },
            this.onOpenTelnetStream.bind(this)
        );
    }

    onOpenTelnetStream(response : APIResponse, error: Error){
        this.hidePopup(this.progressGUID);
        if (error === null){
            if (response.code === 0 && typeof response.output === 'string'){
                //Everything is cool.
                this.connection = response.output;
                this.attachTelnetStream();
            } else{
                this.showMessage(_('Error'), _('Server returned failed result. Code of error: ') + response.code + _('. Addition data: ') + this.outputToString(response.output));
            }
        } else {
            this.showMessage(_('Error'), error.message);
        }
    }

    showSettings(settings: any){
        let GUID        = Symbol();
        let params      = Object.assign({
            proceed : function (GUID: symbol, settings: any) {
                const alias = this.Settings.getAlias(settings);
                this.Settings.save(alias, settings);
                this.hidePopup(GUID);
                this.openTelnetStream(alias, settings);
            }.bind(this, GUID),
            cancel  : function (GUID: symbol) {
                this.hidePopup(GUID);
            }.bind(this, GUID)
        }, settings);
        popupController.open({
            content : {
                factory     : null,
                component   : DialogTelnetSettings,
                params      : params
            },
            title   : _('Configuration of telnet connection'),
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

    closeTelnetStream(){
        this.telnetStream !== null && this.telnetStream.onStop();
    }

    attachTelnetStream(){
        this.telnetStream = new TelnetStream(this.connection, this.alias);
    }

}

export { OpenTelnetStream };
