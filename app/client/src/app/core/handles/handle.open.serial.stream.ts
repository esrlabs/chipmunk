import { MenuHandleInterface            } from './handle.interface';
import { popupController                } from '../components/common/popup/controller';
import { ProgressBarCircle              } from '../components/common/progressbar.circle/component';
import { SimpleText                     } from '../components/common/text/simple/component';
import { DialogSerialSettings           } from '../components/common/dialogs/serial.settings/component';
import { DialogSerialPortsList          } from '../components/common/dialogs/serialports.list/component';

import { events as Events               } from '../modules/controller.events';
import { configuration as Configuration } from '../modules/controller.config';

import { APIProcessor                   } from '../api/api.processor';
import { APICommands                    } from '../api/api.commands';
import { APIResponse                    } from '../api/api.response.interface';

import { SerialSedingPackage            } from '../interfaces/interface.serial.send.package';
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

const DEFAULT_PORT_SETTINGS = {
    lock           : true,
    baudRate       : 921600,
    dataBits       :  8,
    stopBits       : 1,
    rtscts         : false,
    xon            : false,
    xoff           : false,
    xany           : false,
    bufferSize     : 65536,
    vmin           : 1,
    vtime          : 0,
    vtransmit      : 50
};

class SettingsController{

    defaults(){
        return Object.assign({}, DEFAULT_PORT_SETTINGS);
    }

    load(port: string){
        let settings = localSettings.get();
        if (settings !== null && settings[KEYs.serial_ports] !== void 0 && settings[KEYs.serial_ports] !== null && settings[KEYs.serial_ports][port] !== void 0){
            return Object.assign({}, settings[KEYs.serial_ports][port]);
        } else {
            return this.defaults();
        }
    }

    save(port: string, settings: Object){
        if (typeof settings === 'object' && settings !== null){
            localSettings.set({
                [KEYs.serial_ports] : {
                    [port] : settings
                }
            });
        }
    }
}

class SerialSender{

    private ID: symbol = Symbol();
    private barAPI : BarAPI = null;
    private message: string = '';
    private packageGUID: string = null;
    private history: Array<string> = [];
    private historyCursor: number = -1;

    constructor(){
        Events.bind(Configuration.sets.SYSTEM_EVENTS.DATA_TO_SERIAL_SENT, this.onDATA_TO_SERIAL_SENT.bind(this));
    }

    addButton(){
        Events.trigger(Configuration.sets.EVENTS_VIEWS.VIEW_SEARCH_RESULTS_BUTTON_ADD, {
            id          : this.ID,
            title       : 'Send data to port',
            icon        : 'fa-keyboard-o',
            active      : false,
            onKeyUp     : this.onKeyUp.bind(this),
            onEnter     : this.onEnter.bind(this),
            placeholder : 'type command for serial port'
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
                this.barAPI.setValue(this.history[this.historyCursor]);
                break;
            case 40:
                this.historyCursor -= 1;
                if (this.historyCursor < 0) {
                    this.historyCursor = 0;
                }
                this.barAPI.setValue(this.history[this.historyCursor]);
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
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.READY_TO_SEND_DATA_TO_SERIAL, {
            packageGUID : this.packageGUID,
            buffer      : this.message + '\n\r' + ' ',
        } as SerialSedingPackage);
    }

    onDATA_TO_SERIAL_SENT(params: any){
        if (params.packageGUID === this.packageGUID){
            this.barAPI !== null && this.barAPI.hideProgress();
            this.packageGUID = null;
            this.barAPI.setValue('');
        }
    }
}

class SerialStream{
    private connection  : string            = null;
    private port        : string            = null;
    private state       : symbol            = STREAM_STATE.WORKING;
    private buffer      : string            = '';
    private sender      : SerialSender      = new SerialSender();
    private buttons     = {
        STOP        : Symbol(),
        PLAYPAUSE   : Symbol()
    };

    constructor(connection: string, port: string){
        this.connection         = connection;
        this.port               = port;
        this.onData             = this.onData.bind(this);
        this.onStop             = this.onStop.bind(this);
        this.onPause            = this.onPause.bind(this);
        this.onStreamReset      = this.onStreamReset.bind(this);
        this.onReadyToSendData  = this.onReadyToSendData.bind(this);
        this.onLostConnection   = this.onLostConnection.bind(this);
        this.addButtonsInToolBar();
        this.sender.addButton();
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.DESCRIPTION_OF_STREAM_UPDATED,  this.port);
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.TXT_DATA_COME,                  '');
        Events.bind(Configuration.sets.SYSTEM_EVENTS.SERIAL_DATA_COME,                  this.onData);
        Events.bind(Configuration.sets.SYSTEM_EVENTS.TXT_DATA_COME,                     this.onStreamReset);
        Events.bind(Configuration.sets.SYSTEM_EVENTS.READY_TO_SEND_DATA_TO_SERIAL,      this.onReadyToSendData);
        Events.bind(Configuration.sets.SYSTEM_EVENTS.WS_DISCONNECTED,                   this.onLostConnection);
    }

    addButtonsInToolBar(){
        Events.trigger(Configuration.sets.EVENTS_TOOLBAR.ADD_BUTTON, [
            { id : this.buttons.STOP,       icon: BUTTONS_ICONS.STOP,   caption : BUTTONS_CAPTIONS.STOP,    handle: this.onStop,    enable: true},
            { id : this.buttons.PLAYPAUSE,  icon: BUTTONS_ICONS.PAUSE,  caption : BUTTONS_CAPTIONS.PAUSE,   handle: this.onPause,   enable: true},
        ]);
    }

    destroy(){
        //Unbind events
        Events.unbind(Configuration.sets.SYSTEM_EVENTS.SERIAL_DATA_COME,                this.onData);
        Events.unbind(Configuration.sets.SYSTEM_EVENTS.TXT_DATA_COME,                   this.onStreamReset);
        Events.unbind(Configuration.sets.SYSTEM_EVENTS.READY_TO_SEND_DATA_TO_SERIAL,    this.onReadyToSendData);
        Events.unbind(Configuration.sets.SYSTEM_EVENTS.WS_DISCONNECTED,                 this.onLostConnection);
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
                APICommands.closeSerialStream,
                {
                    port        : this.port,
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

    onReadyToSendData(params: SerialSedingPackage){
        if (params.packageGUID !== void 0 && params.buffer !== void 0){
            Events.trigger(Configuration.sets.SYSTEM_EVENTS.SEND_DATA_TO_SERIAL, {
                packageGUID : params.packageGUID,
                port        : this.port,
                serialGUID  : this.connection,
                buffer      : params.buffer
            });
        }
    }

    onLostConnection(){
        this.destroy();
    }
}

class OpenSerialStream implements MenuHandleInterface{
    private GUID            : symbol                = Symbol();
    private progressGUID    : symbol                = Symbol();
    private processor       : any                   = APIProcessor;
    private port            : string                = null;
    private connection      : string                = null;
    private Settings        : SettingsController    = new SettingsController();

    constructor(){
    }

    start(){
        this.getListPorts();
    }

    getListPorts(){
        this.showProgress(_('Please wait... Getting list of available ports.'));
        this.processor.send(
            APICommands.serialPortsList,
            {},
            this.onListOfPorts.bind(this)
        );
    }

    onListOfPorts(response : APIResponse, error: Error){
        this.hidePopup(this.progressGUID);
        if (error === null){
            if (response.code === 0 && response.output instanceof Array){
                this.showList(response.output);
            } else{
                this.showMessage(_('Error'), _('Server returned failed result. Code of error: ') + response.code + _('. Addition data: ') + this.outputToString(response.output));
            }
        } else {
            this.showMessage(_('Error'), error.message);
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

    openSerialPort(port: string, settings: Object){
        this.showProgress(_('Please wait... Opening ') + port);
        this.port = port;
        this.processor.send(
            APICommands.openSerialPort,
            {
                port        : port,
                settings    : settings
            },
            this.onOpenSerialPort.bind(this)
        );
    }

    onOpenSerialPort(response : APIResponse, error: Error){
        this.hidePopup(this.progressGUID);
        if (error === null){
            if (response.code === 0 && typeof response.output === 'string'){
                //Everything is cool.
                this.connection = response.output;
                this.attachSerialStream();
            } else{
                this.showMessage(_('Error'), _('Server returned failed result. Code of error: ') + response.code + _('. Addition data: ') + this.outputToString(response.output));
            }
        } else {
            this.showMessage(_('Error'), error.message);
        }
    }

    showSettings(port: string){
        let GUID        = Symbol();
        let settings    = this.Settings.load(port);
        let params      = Object.assign({
            proceed : function (GUID: symbol, port: string, settings: any) {
                this.Settings.save(port, settings);
                this.hidePopup(GUID);
                this.openSerialPort(port, settings);
            }.bind(this, GUID, port),
            cancel  : function (GUID: symbol, port: string) {
                this.hidePopup(GUID);
            }.bind(this, GUID, port)
        }, settings);
        popupController.open({
            content : {
                factory     : null,
                component   : DialogSerialSettings,
                params      : params
            },
            title   : _('Configuration of connection: ') + port,
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

    showList(list: Array<any>){
        let GUID = Symbol();
        popupController.open({
            content : {
                factory     : null,
                component   : DialogSerialPortsList,
                params      : {
                    ports   : list.map((item)=>{
                        return {
                            name: item.comName,
                            id  : item.comName
                        }
                    }),
                    handler : function (GUID: symbol, portID: string, settings: boolean) {
                        let settingsController = new SettingsController();
                        this.hidePopup(GUID);
                        settings ? this.showSettings(portID) : this.openSerialPort(portID, settingsController.load(portID));
                    }.bind(this, GUID)
                }
            },
            title   : _('Available ports'),
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

    closeSerial(connection: string, port: string){

    }

    attachSerialStream(){
        let serialStream = new SerialStream(this.connection, this.port);
    }


}

export { OpenSerialStream, DEFAULT_PORT_SETTINGS };
