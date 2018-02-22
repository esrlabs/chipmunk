import {Component, OnInit, ComponentFactoryResolver, ViewContainerRef, ChangeDetectorRef, ViewChild, EventEmitter, OnDestroy } from '@angular/core';

import { ViewControllerPattern                  } from '../controller.pattern';

import { SerialSedingPackage                    } from '../../core/interfaces/interface.serial.send.package';
import { events as Events                       } from '../../core/modules/controller.events';
import { configuration as Configuration         } from '../../core/modules/controller.config';

import { ViewInterface                          } from '../../core/interfaces/interface.view';
import { EVENT_DATA_IS_UPDATED                  } from '../../core/interfaces/events/DATA_IS_UPDATE';

import { ViewClass                              } from '../../core/services/class.view';

import { GUID                                   } from '../../core/modules/tools.guid';

import { HistoryItem, HistoryItemWrapper        } from './interface.history.item';

import { localSettings, KEYs                    } from '../../core/modules/controller.localsettings';

const SETTINGS = {
    VERIFYING_TIMEOUT   : 5000, //ms
    SENDING_ATTEMPTS    : 0,
    HISTORY_KEY         : 'history'
};

class Journal {

    public GUID         : string = '';
    public buffer       : string = '';
    public incomes      : number = 0;
    public attempts     : number = 0;

    constructor(GUID: string, buffer: string){
        this.GUID       = GUID;
        this.buffer     = buffer;
        this.incomes    = 0;
        this.attempts   = 0;
    }

    isConfirmed(income: string): boolean{
        let _income = income.replace(/\r?\n|\r/gi,'');
        if (~_income.indexOf(this.buffer)){
            return true;
        } else {
            this.incomes += 1;
            return false;
        }
    }

    getIncomes(){
        return this.incomes;
    }

    addAttempt(){
        this.attempts += 1;
        return this.attempts;
    }

    setAttempt(value: number){
        this.attempts = value;
    }

    getAttempts(){
        return this.attempts;
    }

    getBuffer(){
        return this.buffer;
    }

    getGUID(){
        return this.GUID;
    }
};

@Component({
    selector        : 'view-controller-stream-sender',
    templateUrl     : './template.html'
})

export class ViewControllerStreamSender extends ViewControllerPattern implements ViewInterface, OnInit, OnDestroy {

    @ViewChild ('input', { read: ViewContainerRef }) input: ViewContainerRef;

    public STATES : {
        TYPING      : symbol,
        SENDING     : symbol,
        VERIFYING   : symbol,
        REPEATING   : symbol,
        FAILED      : symbol
    } = {
        TYPING      : Symbol(),
        SENDING     : Symbol(),
        VERIFYING   : Symbol(),
        REPEATING   : Symbol(),
        FAILED      : Symbol()
    };

    public viewParams       : ViewClass                 = null;
    public value            : string                    = '';
    public packageGUID      : string                    = null;
    public verityTimer      : number                    = -1;
    public history          : Array<HistoryItemWrapper> = [];
    public STATE            : symbol                    = this.STATES.TYPING;
    public journal          : Journal                   = null;

    ngOnInit(){
        this.viewParams !== null && super.setGUID(this.viewParams.GUID);
    }

    ngOnDestroy(){
        [   Configuration.sets.SYSTEM_EVENTS.DATA_TO_SERIAL_SENT,
            Configuration.sets.SYSTEM_EVENTS.DATA_IS_UPDATED,
            Configuration.sets.SYSTEM_EVENTS.ROW_IS_SELECTED,
            Configuration.sets.SYSTEM_EVENTS.DATA_FILTER_IS_UPDATED,
            Configuration.sets.SYSTEM_EVENTS.DATA_IS_MODIFIED,
            Configuration.sets.SYSTEM_EVENTS.STREAM_DATA_UPDATE].forEach((handle: string)=>{
            Events.unbind(handle, this['on' + handle]);
        });
    }

    forceUpdate(){
        this.changeDetectorRef.detectChanges();
    }

    constructor(
        private componentFactoryResolver    : ComponentFactoryResolver,
        private viewContainerRef            : ViewContainerRef,
        private changeDetectorRef           : ChangeDetectorRef
    ){
        super();
        this.componentFactoryResolver   = componentFactoryResolver;
        this.viewContainerRef           = viewContainerRef;
        this.changeDetectorRef          = changeDetectorRef;
        this.onCancel                   = this.onCancel.bind(this);
        this.onRepeat                   = this.onRepeat.bind(this);
        [   Configuration.sets.SYSTEM_EVENTS.DATA_TO_SERIAL_SENT,
            Configuration.sets.SYSTEM_EVENTS.DATA_IS_UPDATED,
            Configuration.sets.SYSTEM_EVENTS.ROW_IS_SELECTED,
            Configuration.sets.SYSTEM_EVENTS.DATA_FILTER_IS_UPDATED,
            Configuration.sets.SYSTEM_EVENTS.DATA_IS_MODIFIED,
            Configuration.sets.SYSTEM_EVENTS.STREAM_DATA_UPDATE].forEach((handle: string)=>{
            this['on' + handle] = this['on' + handle].bind(this);
            Events.bind(handle, this['on' + handle]);
        });
        this.loadHistory();
    }

    getIndexInHistory(value: string) : number {
        return this.history.findIndex((item: HistoryItemWrapper)=>{
            return item.item.value === value;
        });
    }

    getCurrentTime(){
        function fill(num: number){
            return num >= 10 ? ('' + num) : ('0' + num);
        }
        let time = new Date();
        return fill(time.getHours()) + ':' + fill(time.getMinutes()) + ':' + fill(time.getSeconds());
    }

    loadHistory(){
        let settings = localSettings.get();
        if (settings !== null && settings[KEYs.view_serialsender] !== void 0 && settings[KEYs.view_serialsender] !== null && settings[KEYs.view_serialsender][SETTINGS.HISTORY_KEY] instanceof Array){
            this.history = settings[KEYs.view_serialsender][SETTINGS.HISTORY_KEY].map((item: Object)=>{
                return {
                    item        : item,
                    onChange    : new EventEmitter(),
                    onTyping    : new EventEmitter(),
                    onRemove    : this.onRemove.bind(this, item['value']),
                    onSelect    : this.onSelect.bind(this, item['value']),
                };
            });
        }
    }

    saveHistory(){
        localSettings.set({
            [KEYs.view_serialsender] : {
                [SETTINGS.HISTORY_KEY] : this.history.map((element)=>{
                    return element.item;
                })
            }
        });
    }

    addToHistory(value: string){
        let index = this.getIndexInHistory(value);
        if (value.trim() !== ''){
            if (!~index){
                this.history.push({
                    item    : {
                        value   : value,
                        usage   : 1,
                        time    : this.getCurrentTime(),
                        stamp   : (new Date).getTime(),
                        match   : false,
                        selected: false
                    },
                    onChange : new EventEmitter(),
                    onTyping : new EventEmitter(),
                    onRemove : this.onRemove.bind(this, value),
                    onSelect : this.onSelect.bind(this, value),
                });
            } else {
                this.history[index].item.usage  += 1;
                this.history[index].item.time   = this.getCurrentTime();
                this.history[index].item.stamp  = (new Date).getTime();
                this.history[index].onChange.emit(this.history[index].item);
            }
            this.saveHistory();
            this.forceUpdate();
        }
    }

    updateSelecting(str: string){
        this.history.forEach((item: HistoryItemWrapper)=>{
            item.onTyping.emit(str);
            if (str !== ''){
                item.item.match = item.item.value.indexOf(str) === 0 ? true : false;
            } else {
                item.item.match = false
            }
        });
    }

    updateSorting(){
        let match = false;
        this.history.sort((a, b)=>{
            let matchRate   = 99999999,
                usageA      = a.item.match ? (matchRate + a.item.usage) : a.item.usage,
                usageB      = b.item.match ? (matchRate + b.item.usage) : b.item.usage;
            match = a.item.match ? true : (b.item.match ? true : match);
            return usageB - usageA;
        });
        if (match){
            this.setSelected(0);
        } else {
            this.setSelected(-1);
        }
    }

    setSelected(index: number){
        this.history.forEach((item : HistoryItemWrapper, _index : number)=>{
            item.item.selected = (index === _index);
        });
    }

    getSelected(){
        let index = -1;
        this.history.forEach((item : HistoryItemWrapper, _index : number)=>{
            index = item.item.selected ? _index : index;
        });
        return index;
    }

    onRemove(str: string){
        let index = this.getIndexInHistory(str);
        if (~index){
            this.history.splice(index, 1);
            this.updateSorting();
            this.saveHistory();
            this.forceUpdate();
        }
    }

    onSelect(str: string){
        this.value = str;
        this.updateSelecting(str);
        this.updateSorting();
        this.forceUpdate();
    }

    onSelectUp(){
        let selected = this.getSelected();
        selected -= 1;
        selected = selected < 0 ? 0 : selected;
        this.setSelected(selected);
    }

    onSelectDown(){
        let selected = this.getSelected();
        selected += 1;
        selected = selected > (this.history.length - 1) ? (this.history.length - 1) : selected;
        this.setSelected(selected);
    }

    onChooseSelection(){
        let selected = this.getSelected();
        ~selected && this.onSelect(this.history[selected].item.value);
    }

    onDATA_IS_UPDATED(event : EVENT_DATA_IS_UPDATED){
    }

    onDATA_FILTER_IS_UPDATED(event : EVENT_DATA_IS_UPDATED){
    }

    onDATA_IS_MODIFIED(event : EVENT_DATA_IS_UPDATED){
    }

    onROW_IS_SELECTED(index : number){
    }

    onSTREAM_DATA_UPDATE(str: string){
        if (this.STATE === this.STATES.VERIFYING){
            if (this.journal.isConfirmed(str)){
                this.journal        = null;
                this.packageGUID    = null;
                this.value          = '';
                this.STATE          = this.STATES.TYPING;
                this.verityTimer    !== -1 && (clearTimeout(this.verityTimer));
                this.verityTimer    = -1;
            }
            this.forceUpdate();
        }
    }

    onDATA_TO_SERIAL_SENT(params: any){
        if (params.packageGUID === this.packageGUID){
            this.verityTimer    = setTimeout(this.onVerityTimer.bind(this, this.packageGUID), SETTINGS.VERIFYING_TIMEOUT);
            this.STATE          = this.STATES.VERIFYING;
        }
    }

    onVerityTimer(GUID: string){
        if (this.journal.addAttempt() <= SETTINGS.SENDING_ATTEMPTS){
            this.STATE = this.STATES.REPEATING;
            this.sendPackage(GUID, this.journal.getBuffer(), this.journal);
        } else {
            this.STATE = this.STATES.FAILED;
        }
    }

    sendPackage(GUID: string, buffer: string, journal: Journal = null){
        this.packageGUID    = GUID;
        this.value          = buffer;
        journal === null && (this.journal = new Journal(GUID, buffer));
        journal === null && (this.addToHistory(buffer));
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.READY_TO_SEND_DATA_TO_SERIAL, {
            packageGUID : this.packageGUID,
            buffer      : this.value + '\n\r' + ' ',
        } as SerialSedingPackage);
        this.updateSelecting('');
        this.updateSorting();
        this.forceUpdate();
    }

    onKeyPress(event : KeyboardEvent){
        if (event.keyCode === 13 && this.packageGUID === null){
            if (this.value.trim().length > 0){
                this.STATE = this.STATES.SENDING;
                this.sendPackage(GUID.generate(), this.value, null);
            }
            event.preventDefault();
        }
    }

    onKeyUp(event : any){
        if (!~[13, 37, 38, 39, 9, 40].indexOf(event.keyCode) && this.packageGUID === null) {
            this.updateSelecting(event.target.value);
            this.updateSorting();
            this.forceUpdate();
        }
    }

    onKeyDown(event : any){
        switch (event.keyCode){
            case 38:
                this.onSelectUp();
                event.preventDefault();
                return false;
            case 9:
                this.onChooseSelection();
                event.preventDefault();
                return false;
            case 40:
                this.onSelectDown();
                event.preventDefault();
                return false;
        }
    }

    onCancel(){
        this.packageGUID    = null;
        this.STATE          = this.STATES.TYPING;
        this.verityTimer    !== -1 && (clearTimeout(this.verityTimer));
        this.verityTimer    = -1;
        this.forceUpdate();
    }

    onRepeat(){
        this.journal.setAttempt(0);
        this.sendPackage(this.journal.getGUID(), this.journal.getBuffer(), this.journal);
    }

    onFocus(){
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.SHORTCUTS_SILENCE_ON);
    }

    onBlur(){
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.SHORTCUTS_SILENCE_OFF);
    }

}
