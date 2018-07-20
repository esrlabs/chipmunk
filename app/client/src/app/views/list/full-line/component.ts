import {Component, Input, OnDestroy, OnChanges, AfterContentChecked, ChangeDetectorRef, ViewChild, ViewContainerRef } from '@angular/core';

import {EContextMenuItemTypes, IContextMenuEvent} from "../../../core/components/context-menu/interfaces";
import {configuration as Configuration} from "../../../core/modules/controller.config";
import {events as Events} from "../../../core/modules/controller.events";
import * as Parsers from "../../../core/modules/controller.parsers";

@Component({
  selector      : 'list-view-full-line',
  templateUrl   : './template.html'
})

export class ViewControllerListFullLine implements OnDestroy, OnChanges, AfterContentChecked{
    @ViewChild ('textarea', { read: ViewContainerRef}) textareaRef: ViewContainerRef;

    @Input() value: string = '';
    private selection: string = '';
    private results: string = '';
    private str: string = '';

    ngOnDestroy(){

    }

    constructor(private changeDetectorRef   : ChangeDetectorRef,
                private viewContainerRef    : ViewContainerRef){
        this.changeDetectorRef  = changeDetectorRef;
        this.viewContainerRef   = viewContainerRef;
    }

    ngAfterContentChecked(){
        if (this.results === '') {
            this.str = this.value;
        } else {
            this.str = this.results;
        }
    }

    ngOnChanges(){
        this.setSelection();
    }

    forceUpdate(){
        this.changeDetectorRef.detectChanges();
    }

    setSelection(){
        if (this.textareaRef === void 0 || this.textareaRef === null) {
            this.selection = '';
        }
        const element = this.textareaRef.element.nativeElement;
        const start = element.selectionStart;
        const finish = element.selectionEnd;
        this.selection = element.value.substring(start, finish);
    }

    onBackToString(){
        this.str = this.value;
        this.results = '';
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    * Context menu
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    onContextMenu(event: MouseEvent){
        this.setSelection();
        if (this.selection.trim() === '' || this.results !== '') {
            event.preventDefault();
            event.stopPropagation();
            return false;
        }
        const items: Array<any> = [];
        Object.keys(Parsers).forEach((parser: string) => {
            const implementation = new Parsers[parser](this.selection);
            const test: boolean = implementation.test();
            const name: string = implementation.name;
            if (!implementation.test()) {
                return false;
            }
            items.push({
                caption : `${implementation.name}`,
                type    : EContextMenuItemTypes.item,
                handler : () => {
                    this.results = implementation.convert();
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
