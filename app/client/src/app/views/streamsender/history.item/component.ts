import {Component, OnInit, ComponentFactoryResolver, ViewContainerRef, ChangeDetectorRef, ViewChild, EventEmitter, Input, OnDestroy, AfterViewInit } from '@angular/core';

import { events as Events                       } from '../../../core/modules/controller.events';
import { configuration as Configuration         } from '../../../core/modules/controller.config';

import { GUID                                   } from '../../../core/modules/tools.guid';

import { HistoryItem                            } from '../interface.history.item';

@Component({
    selector        : 'stream-sender-history-item',
    templateUrl     : './template.html'
})

export class StreamSenderHistoryItem implements OnInit, OnDestroy, AfterViewInit {
    @Input() item       : HistoryItem               = null;
    @Input() onChange   : EventEmitter<HistoryItem> = null;
    @Input() onTyping   : EventEmitter<string>      = null;
    @Input() onRemove   : Function                  = null;

    public  before      : string                    = '';
    public  after       : string                    = '';
    private bound       : boolean                   = false;

    ngOnInit(){
    }

    ngOnDestroy(){
        this.onChange.unsubscribe();
        this.onTyping.unsubscribe();
    }

    ngAfterViewInit(){
        if (!this.bound){
            this.bound          = true;
            this.handleOnChange = this.handleOnChange.bind(this);
            this.handleOnTyping = this.handleOnTyping.bind(this);
            this.onChange.subscribe(this.handleOnChange);
            this.onTyping.subscribe(this.handleOnTyping);
        }
        this.updateSelected('');
    }

    updateSelected(typed: string){
        if (this.item.value.indexOf(typed) === 0){
            this.before = typed;
            this.after  = this.item.value.replace(typed, '');
        } else {
            this.before = '';
            this.after  = this.item.value;
        }
    }

    handleOnChange(item: HistoryItem){
        Object.keys(item).forEach((key)=>{
            this.item[key] = item[key];
        });
        this.forceUpdate();
    }

    handleOnTyping(typed: string){
        this.updateSelected(typed);
        this.forceUpdate();
    }

    onRemoveItem(event: MouseEvent){
        this.onRemove();
        event.preventDefault();
        return false;
    }

    forceUpdate(){
        this.changeDetectorRef.detectChanges();
    }

    constructor(
        private componentFactoryResolver    : ComponentFactoryResolver,
        private viewContainerRef            : ViewContainerRef,
        private changeDetectorRef           : ChangeDetectorRef
    ){
        this.componentFactoryResolver   = componentFactoryResolver;
        this.viewContainerRef           = viewContainerRef;
        this.changeDetectorRef          = changeDetectorRef;
    }

}
