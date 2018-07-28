import {Component, Input, Output, OnDestroy, OnChanges, AfterContentChecked, ChangeDetectorRef, ViewChild, ViewContainerRef } from '@angular/core';

import {EContextMenuItemTypes, IContextMenuEvent} from "../../../core/components/context-menu/interfaces";
import {configuration as Configuration} from "../../../core/modules/controller.config";
import {events as Events} from "../../../core/modules/controller.events";
import * as Parsers from "../../../core/modules/controller.parsers";

interface IField{
    value: string;
    caption: string;
}

@Component({
  selector      : 'list-view-full-line',
  templateUrl   : './template.html'
})

export class ViewControllerListFullLine implements OnDestroy, OnChanges, AfterContentChecked{

    @Input() value: string = '';
    @Input() closeHandler: Function = null;

    private fields: Array<IField> = [];
    private currentFieldElement: HTMLTextAreaElement = null;
    private currentFieldIndex: number = -1;

    ngOnDestroy(){

    }

    constructor(private changeDetectorRef   : ChangeDetectorRef,
                private viewContainerRef    : ViewContainerRef){
        this.changeDetectorRef  = changeDetectorRef;
        this.viewContainerRef   = viewContainerRef;
    }

    ngAfterContentChecked(){
        if (this.fields.length === 0 || this.fields[0].value !== this.value) {
            this.setupOriginal();
        }
    }

    ngOnChanges(){
    }

    forceUpdate(){
        this.changeDetectorRef.detectChanges();
    }

    onMouseDown(index: number, event: MouseEvent){
        this.currentFieldElement = event.target as HTMLTextAreaElement;
        this.currentFieldIndex = index;
    }

    getSelection(): string | null {
        if (this.currentFieldElement === null || this.currentFieldElement === void 0) {
            return null;
        }
        const start = this.currentFieldElement.selectionStart;
        const finish = this.currentFieldElement.selectionEnd;
        return this.currentFieldElement.value.substring(start, finish);
    }

    onCloseField(index: number){
        if (index === 0) {
            typeof this.closeHandler === 'function' && this.closeHandler();
            return;
        }
        this.fields.splice(index, this.fields.length - index);
    }

    setupOriginal(){
        this.fields = [{
            caption: 'Original',
            value: this.value
        }];
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    * Public methods
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    @Output() setValue(value: string){
        this.value = value;
        this.setupOriginal();
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    * Context menu
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    onContextMenu(event: MouseEvent){
        const selection = this.getSelection();
        if (selection === null || selection.trim() === '') {
            event.preventDefault();
            event.stopPropagation();
            return false;
        }
        const items: Array<any> = [];
        Object.keys(Parsers).forEach((parser: string) => {
            const implementation = new Parsers[parser](selection);
            const test: boolean = implementation.test();
            const name: string = implementation.name;
            if (!implementation.test()) {
                return false;
            }
            items.push({
                caption : `${implementation.name}`,
                type    : EContextMenuItemTypes.item,
                handler : () => {
                    this.fields.push({
                        caption: name,
                        value: implementation.convert()
                    });
                }
            });
        });
        const contextEvent = {
            x: event.pageX,
            y: event.pageY,
            items: items} as IContextMenuEvent;
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.CONTEXT_MENU_CALL, contextEvent);
        event.preventDefault();
        event.stopPropagation();
        return false;
    }

}
