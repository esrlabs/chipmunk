import { InitiableModule } from '../interfaces/interface.module.initiable';
import { Logs, TYPES as LogTypes    } from './tools.logs';

const GUID = Symbol('__eventsControllerGUIDSymbol');

class Event {
    private id      : string = '';
    private handles : Object = {};

    constructor(id : string = ''){
        this.id         = id;
        this.handles    = {};
    }

    attach(handle : Function){
        let symbol              = Symbol();
        this.handles[symbol]    = handle;
        handle[GUID]            = symbol;
        return handle[GUID];
    }

    detach(smth : any){
        if (typeof smth === 'function' && smth[GUID] !== void 0){
            delete this.handles[smth[GUID]];
        } else if (typeof smth === 'symbol'){
            delete this.handles[smth[GUID]];
        }
    }

    handle(...agrs: any[]){
        Promise.all(Object.getOwnPropertySymbols(this.handles).map((GUID)=>{
            return new Promise((resolve, reject)=>{
                try{
                    this.handles[GUID](...agrs);
                    resolve();
                } catch (e) {
                    console.log(e.message);
                    reject(e);
                }
            });
        })).catch((e)=>{
            throw e;
        });
    }

    isEmpty(){
        return Object.getOwnPropertySymbols(this.handles).length === 0;
    }
}

class Events implements InitiableModule{
    private storage : any;

    constructor(){
        this.storage = new Map();
    }

    init(callback : Function){
        Logs.msg('[controller.events][OK]:: ready.', LogTypes.LOADING);
        callback();
    }

    add(id : string = ''){
        if (typeof id === 'string' && id.trim() === ''){
            Logs.msg('[controller.events][TypeError]:: Event name (id) cannot be empty string.', LogTypes.ERROR);
        } else if (typeof id === 'string' || typeof id === 'symbol') {
            !this.storage.has(id) && this.storage.set(id, (new Event(id)));
            return this.storage.get(id);
        } else {
            Logs.msg('[controller.events][TypeError]:: Event name (id) can be a STRING or SYMBOL.', LogTypes.ERROR);
        }
    }

    bind(id : string = '', handle : Function = null){
        let holder = this.add(id);
        return holder.attach(handle);
    }

    unbind(id : string = '', smth : any){
        if (this.storage.has(id)){
            let holder = this.storage.get(id);
            holder.detach(smth);
            holder.isEmpty() && this.storage.delete(id);
        }
    }

    trigger(id : string, ...args : any[]){
        let holder = this.storage.get(id);
        holder && holder.handle(...args);
        holder && Logs.msg('[controller.events][Triggering]:: ' + id, LogTypes.EVENT_TRACKING);
    }
}

interface EventControllerRecord{
    event: string,
    GUID : Symbol
}

class EventsController{
    private GUIDs : Array<EventControllerRecord> = [];

    bind(event: any, handle: Function){
        this.GUIDs.push({
            event   : event,
            GUID    : events.bind(event,  handle)
        });
    }

    trigger(id : string, ...args : any[]){
        events.trigger(id, ...args);
    }

    kill(){
        this.GUIDs.forEach((event : EventControllerRecord)=>{
            events.unbind(event.event, event.GUID);
        });
    }
}

let events = new Events();

export {events, EventsController};
