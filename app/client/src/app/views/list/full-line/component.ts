import {Component, Input, Output, OnDestroy, OnChanges, AfterContentChecked, ChangeDetectorRef, ViewChild, ViewContainerRef } from '@angular/core';

import {EContextMenuItemTypes, IContextMenuEvent} from "../../../core/components/context-menu/interfaces";
import {configuration as Configuration} from "../../../core/modules/controller.config";
import {events as Events} from "../../../core/modules/controller.events";
import * as Parsers from "../../../core/modules/controller.parsers";
import { safelyCreateRegExp, serializeStringForReg } from "../../../core/modules/tools.regexp";
import { clearHTML } from "../../../core/modules/tools.htmlserialize";
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

interface IField{
    value: string;
    html: SafeHtml;
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
    private selection: string = '';

    ngOnDestroy(){

    }

    constructor(private changeDetectorRef   : ChangeDetectorRef,
                private viewContainerRef    : ViewContainerRef,
                private sanitizer           : DomSanitizer){
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

    onMouseDown(field: IField, event: MouseEvent){
        this.currentFieldElement = event.target as HTMLTextAreaElement;
    }

    onMouseUp(index: number, event: MouseEvent){
        let selection = window.getSelection();
        if (typeof selection.toString === 'function'){
            this.selection = selection.toString();
            console.log('GOOOD');
        } else {
            this.selection = '';
            console.log('BAD');
        }
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
            value: this.value,
            html: this.getHTML(this.value)
        }];
    }

    getHTML(value: string, selection: string = ''): SafeHtml{
        selection = clearHTML(selection);
        value = clearHTML(value);
        if (selection.trim() === '') {
            return this.sanitizer.bypassSecurityTrustHtml(value);
        }
        if (value.indexOf(selection) === -1) {
            return this.sanitizer.bypassSecurityTrustHtml(value);
        }
        const reg = safelyCreateRegExp(serializeStringForReg(selection));
        if (!(reg instanceof RegExp)){
            return this.sanitizer.bypassSecurityTrustHtml(value);
        }
        return this.sanitizer.bypassSecurityTrustHtml(value.replace(reg, `<span class="selection">${selection}</span>`));
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
    onContextMenu(index: number, event: MouseEvent){
        if (this.selection === null || this.selection.trim() === '') {
            event.preventDefault();
            event.stopPropagation();
            return false;
        }
        if (this.fields[index] === void 0) {
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
                    const converted = implementation.convert();
                    if (this.fields.length - 1 > index) {
                        this.fields.splice(index + 1, this.fields.length);
                    }
                    this.fields.push({
                        caption: name,
                        value: converted,
                        html: this.getHTML(converted)
                    });
                    this.fields[index].html = this.getHTML(this.fields[index].value, this.selection);
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
