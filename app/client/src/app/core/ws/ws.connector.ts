import { events as Events               } from '../modules/controller.events';
import { configuration as Configuration } from '../modules/controller.config';
import { GUID as GUIDGenerator          } from '../modules/tools.guid';
import { Logs, TYPES                    } from '../modules/tools.logs';
import { WSClientProcessor              } from '../ws/ws.processor';
import { WSCommandMessage               } from '../ws/ws.message.interface';
import { COMMANDS                       } from '../ws/ws.commands';
import { IServerSetting, settings       } from "../modules/controller.settings";


const WS_EVENTS = {
    message : 'message',
    error   : 'error',
    open    : 'open',
    close   : 'close'
};

interface WebSocketMessageEvent {
    data : string
};

class SettingsLoader{
    load(){
        const _settings = settings.get();
        return _settings.server;
    }
    save(serverSettings: IServerSetting){
        let _settings = settings.get();
        _settings.server = serverSettings;
        settings.set(_settings);
    }
}

class WebSocketConnector {
    private client      : WebSocket         = null;
    private GUID        : string            = GUIDGenerator.generate();
    private processor   : WSClientProcessor = null;
    private SysEvents   : Array<string>     = [];
    private loader      : SettingsLoader    = new SettingsLoader();
    private settings    : IServerSetting    = null;
    private connected   : boolean           = false;

    constructor(){
        this.SysEvents = [Configuration.sets.SYSTEM_EVENTS.SEND_DATA_TO_SERIAL];
        this.processor = new WSClientProcessor(this.GUID);
        this.settings  = this.loader.load();
        this.SysEvents.forEach((event)=>{
            this['on' + event] = this['on' + event].bind(this);
        });
        this.onWS_STATE_GET         = this.onWS_STATE_GET.bind(this);
        this.onWS_SETTINGS_CHANGED  = this.onWS_SETTINGS_CHANGED.bind(this);
        Events.bind(Configuration.sets.SYSTEM_EVENTS.WS_STATE_GET,          this.onWS_STATE_GET);
        Events.bind(Configuration.sets.SYSTEM_EVENTS.WS_SETTINGS_CHANGED,   this.onWS_SETTINGS_CHANGED);
    }

    onWS_STATE_GET(callback: Function){
        typeof callback === 'function' && callback(this.connected);
    }

    onWS_SETTINGS_CHANGED(settings: IServerSetting){
        let isValid = true;
        if (typeof settings === 'object' && settings !== void 0) {
            if (isValid){
                this.loader.save(settings);
                this.settings = this.loader.load();
                if (this.connected){
                    this.client.close();
                } else {
                    this.destroy();
                }
                this.connected = false;
                this.connect();
            } else {
                Logs.msg('Not valid configuration come from WS_SETTINGS_CHANGED event', TYPES.WARNING);
            }
        } else {
            Logs.msg('Bad configuration come from WS_SETTINGS_CHANGED event', TYPES.WARNING);
        }
    }

    bind(){
        this.SysEvents.forEach((event)=>{
            Events.bind(event, this['on' + event]);
        });
    }

    unbind(){
        this.SysEvents.forEach((event)=>{
            Events.unbind(event, this['on' + event]);
        });
    }

    connect(){
        if (!this.connected){
            Logs.msg(_('Attempt to connect to WS server: ') + this.settings.WS_URL, TYPES.LOG);
            this.client = new WebSocket(
                this.settings.WS_URL,
                this.settings.WS_PROTOCOL
            );
            this.addOriginalListeners();
            this.bind();
            Events.trigger(Configuration.sets.SYSTEM_EVENTS.WS_CONNECTED);
        }
    }

    addOriginalListeners(){
        Object.keys(WS_EVENTS).forEach((event)=>{
            this[WS_EVENTS[event]] = this[WS_EVENTS[event]].bind(this);
            this.client.addEventListener(WS_EVENTS[event], this[WS_EVENTS[event]]);
        });
    }

    removeOriginalListeners(){
        Object.keys(WS_EVENTS).forEach((event)=>{
            this.client.removeEventListener(WS_EVENTS[event], this[WS_EVENTS[event]]);
        });
    }

    destroy(){
        this.removeOriginalListeners();
        this.connected = false;
        this.unbind();
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.WS_STATE_CHANGED, this.connected);
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.WS_DISCONNECTED);
    }

    getJSON(str : string){
        let result = null;
        try {
            result = JSON.parse(str);
        } catch (e){

        }
        return result;
    }

    sendMessage(message: WSCommandMessage){
        this.client.send(JSON.stringify(message));
    }

    reconnection(){
        Logs.msg(_('Attempt to reconnect will be done in ') + (this.settings.WS_RECONNECTION_TIMEOUT / 1000) + ' sec.', TYPES.LOG);
        this.destroy();
        setTimeout(this.connect.bind(this), this.settings.WS_RECONNECTION_TIMEOUT);
    }

    [WS_EVENTS.message](event: WebSocketMessageEvent){
        if (typeof event.data === 'string'){
            let message = this.getJSON(event.data);
            if (message !== null){
                if (message.GUID === this.GUID || (message.GUID === '' && message.command === COMMANDS.greeting)){
                    this.processor.proceed(message, this.sendMessage.bind(this));
                }
            } else {
                Logs.msg(_('WebSocket wrong message. Property data[string] is not JSON string.'), TYPES.ERROR);
            }
        } else {
            Logs.msg(_('WebSocket wrong message. Property data[string] is not gotten.'), TYPES.ERROR);
        }
    }

    [WS_EVENTS.open](event: any){
        this.connected = true;
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.WS_STATE_CHANGED, this.connected);
    }

    [WS_EVENTS.error](event: any){
        let URL = event.target !== void 0 ? (event.target.url !== void 0 ? event.target.url : null) : null;
        Logs.msg(_('WebSocket error connection. Destination address: ') + (URL !== null ? URL : 'not defined'), TYPES.ERROR);
        this.reconnection();
    }

    [WS_EVENTS.close](event: any){
        let URL = event.target !== void 0 ? (event.target.url !== void 0 ? event.target.url : null) : null;
        Logs.msg(_('WebSocket connection was closed. Destination address: ') + (URL !== null ? URL : 'not defined'), TYPES.ERROR);
        this.reconnection();
    }

    onSEND_DATA_TO_SERIAL(params: any){
        this.processor.proceed({
            command : COMMANDS.WriteToSerial,
            params  : params,
            GUID    : this.GUID
        }, this.sendMessage.bind(this));
    }

}

export { WebSocketConnector };