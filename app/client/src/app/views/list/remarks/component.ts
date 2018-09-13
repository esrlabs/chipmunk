import {Component, Input, Output, OnDestroy, OnChanges, AfterContentChecked, AfterViewChecked, ChangeDetectorRef, EventEmitter, ViewContainerRef } from '@angular/core';

import {EContextMenuItemTypes, IContextMenuEvent} from "../../../core/components/context-menu/interfaces";
import {configuration as Configuration} from "../../../core/modules/controller.config";
import {events as Events} from "../../../core/modules/controller.events";

const DEFAULTS_COLORS = [
    '#74b9ff',
    '#b2bec3',
    '#636e72',
    '#c3bd45',
    '#e17055',
    '#778beb',
    '#574b90',
    '#3dc1d3',
    '#6ab04c'
];

export interface IRemark{
    text: string;
    selection: string;
    index: number;
    color: string;
}

@Component({
  selector      : 'list-view-remarks',
  templateUrl   : './template.html'
})

export class ViewControllerListRemarks implements OnDestroy, OnChanges, AfterContentChecked, AfterViewChecked{

    private _silence: boolean = false;
    private _focusTo: number = -1;
    @Input() remarks: Array<IRemark> = [];

    ngOnDestroy(){
        Events.unbind(Configuration.sets.SYSTEM_EVENTS.ROW_IS_SELECTED, this.onROW_IS_SELECTED);
    }

    constructor(private changeDetectorRef   : ChangeDetectorRef,
                private viewContainerRef    : ViewContainerRef){
        this.changeDetectorRef  = changeDetectorRef;
        this.viewContainerRef   = viewContainerRef;
        this.onROW_IS_SELECTED = this.onROW_IS_SELECTED.bind(this);
        Events.bind(Configuration.sets.SYSTEM_EVENTS.ROW_IS_SELECTED, this.onROW_IS_SELECTED);
    }

    ngAfterContentChecked(){
        this.forceUpdate();
    }

    ngAfterViewChecked(){
        if (this._focusTo === -1) {
            return;
        }
        this.setFocus(this._focusTo);
    }

    ngOnChanges(){
    }

    forceUpdate(){
        this.changeDetectorRef.detectChanges();
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    * Outside events
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    onROW_IS_SELECTED(index : number, callEvent: boolean = false){
        if (this._silence) {
            this._silence = false;
            return;
        }
        const target = document.querySelector(`li[id="lv-remarks-com-remark-${index}"]`);
        if (target === null) {
            return;
        }
        target.scrollIntoView();
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    * Manipulation
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    onRemove(index: number) {
        this.remarks.splice(index, 1);
        this.onRemarksUpdated.emit(this.remarks);
    }

    onRemoveAll(){
        this.remarks = [];
        this.onRemarksUpdated.emit(this.remarks);
    }

    onChangingRemark(index: number, event: KeyboardEvent) {
        this.forceUpdate();
    }

    onChangeRemark(index: number, event: KeyboardEvent) {
        const target = event.target as HTMLTextAreaElement;
        this.remarks[index].text = target.value;
        this.onRemarksUpdated.emit(this.remarks);
    }

    onFocus(event: Event){
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.SHORTCUTS_SILENCE_ON);
    }

    onBlur(event: Event){
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.SHORTCUTS_SILENCE_OFF);
    }

    onGoToLine(remark: IRemark) {
        this._silence = true;
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.ROW_IS_SELECTED, remark.index);
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    * Styles
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    getRemarkHeight(index: number): string {
        const target = document.querySelector(`textarea[id="lv-remarks-com-${index}"]`) as HTMLTextAreaElement;
        const blank = document.querySelector(`textarea#lv-remarks-com-blank`) as HTMLTextAreaElement;
        if (blank === null || target === null) {
            return 'auto';
        }
        //Change size
        blank.value = target.value;
        blank.style.display = 'none';
        blank.style.display = '';
        //Get content size
        const height = blank.scrollHeight;
        return `${height + 16}px`;
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    * Public methods
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    @Output() onRemarksUpdated: EventEmitter<Array<IRemark>> = new EventEmitter();
    @Output() scrollIntoView(index: number){
        this.onROW_IS_SELECTED(index);
    }
    @Output() setFocus(index: number){
        const target = document.querySelector(`li[id="lv-remarks-com-remark-${index}"] textarea`) as HTMLTextAreaElement;
        if (target === null) {
            this._focusTo = index;
            return;
        }
        this._focusTo = -1;
        target.focus();
    }
    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    * Context menu
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    onRootContextMenu(event: MouseEvent){
        const contextEvent = {
            x: event.pageX,
            y: event.pageY,
            items: [
                {
                    caption : 'Remove all',
                    type    : EContextMenuItemTypes.item,
                    handler : () => {
                        this.onRemoveAll();
                    }
                }
            ]} as IContextMenuEvent;
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.CONTEXT_MENU_CALL, contextEvent);
        event.preventDefault();
        event.stopPropagation();
        return false;
    }

    onRemarkContextMenu(index: number, event: MouseEvent){
        if (this.remarks[index] === void 0) {
            return;
        }
        const items: Array<any> = [
            { type: EContextMenuItemTypes.divider },
            {
                caption : 'Remove',
                type    : EContextMenuItemTypes.item,
                handler : () => {
                    this.onRemove(index);
                }
            }
        ];
        DEFAULTS_COLORS.forEach((color: string) => {
           items.unshift({
               caption : color,
               color   : color,
               type    : EContextMenuItemTypes.item,
               handler : () => {
                   this.remarks[index].color = color;
                   this.onRemarksUpdated.emit(this.remarks);
                   this.forceUpdate();
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
