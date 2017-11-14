import {Component, Input, Output, OnDestroy, OnChanges, AfterContentChecked, EventEmitter, ChangeDetectorRef, ViewChild, ViewContainerRef } from '@angular/core';

import { ListLineMark                           } from './interface.mark';
import { OnScrollEvent                          } from '../../../core/components/common/long-list/interface.scrollevent';
import { events as Events                       } from '../../../core/modules/controller.events';
import { configuration as Configuration         } from '../../../core/modules/controller.config';

const COLORS = {
    BACKGROUND : 'rgba(0,0,0,1);'
};

const MODES = {
    SCROLL : Symbol(),
    REVIEW : Symbol()
};

interface SelectionItem{
    html    : string,
    onClick : Function
}

@Component({
  selector      : 'list-view-line',
  templateUrl   : './template.html'
})

export class ViewControllerListLine implements OnDestroy, OnChanges, AfterContentChecked{
    @ViewChild ('canvas', { read: ViewContainerRef}) canvasContainerRef: ViewContainerRef;
    @Input() GUID           : string                = '';
    @Input() marks          : Array<ListLineMark>   = [];
    @Input() count          : number                = 0;
    @Input() scroll         : OnScrollEvent         = null;
    @Input() scrollTo       : EventEmitter<number>  = null;
    @Input() offsetTop      : number                = 0;
    @Input() offsetBottom   : number                = 0;

    public top          : number = 0;
    public height       : number = 0;
    public modes        : any    = MODES;
    public mode         : symbol = MODES.SCROLL;

    public selection    : {
        top     : string,
        list    : Array<SelectionItem>
    } = {
        top     : '0px',
        list    : []
    };
    public size : {
        width : number,
        height: number
    } = {
        width : -1,
        height: -1
    };

    private context         : any       = null;
    private needToBeUpdated : boolean   = false;

    ngOnDestroy(){

    }

    constructor(private changeDetectorRef   : ChangeDetectorRef,
                private viewContainerRef    : ViewContainerRef){
        this.changeDetectorRef  = changeDetectorRef;
        this.viewContainerRef   = viewContainerRef;
    }

    resize(soft: boolean = false){
        if (this.viewContainerRef !== void 0 && this.canvasContainerRef !== void 0 &&
            this.viewContainerRef !== null && this.canvasContainerRef !== null){
            let size            = this.viewContainerRef.element.nativeElement.getBoundingClientRect();
            this.size.width     = size.width;
            this.size.height    = size.height;
            soft && this.forceUpdate();
        }
    }

    setupSize(){
        if (this.size.width < 0 || this.size.height < 0){
            this.resize();
        }
    }

    setupContext(){
        if (this.context === null && this.canvasContainerRef !== void 0 && this.canvasContainerRef !== null){
            this.context = this.canvasContainerRef.element.nativeElement.getContext('2d');
        }
    }

    clearDraw(){
        if (this.context !== null){
            this.context.clearRect(0,0, this.size.width, this.getHeight());
        }
    }

    drawScroll(){
        if (this.context !== null && this.scroll !== null && this.marks.length > 0){
            let minHeight = 2,
                rate      = this.getHeight(this.scroll.viewHeight) / this.scroll.scrollHeight,
                height    = this.getHeight(this.scroll.viewHeight) * rate,
                top       = this.scroll.scrollTop * rate;
            height      = height < minHeight ? minHeight : height;
            top         = top > this.getHeight(this.scroll.viewHeight) - height ? this.getHeight(this.scroll.viewHeight) - height : top;
            this.context.fillStyle = 'rgba(0,0,255,0.4)';
            this.context.fillRect(0, top, this.size.width, height);
        }
    }

    drawMarks(){
        if (this.context !== null){
            let rate    = this.getHeight() / this.count,
                height  = rate < 1 ? 1 : rate;
            this.marks.forEach((mark: ListLineMark)=>{
                let y = mark.position * rate;
                this.context.fillStyle = mark.color;
                this.context.fillRect(0, y, this.size.width, height);
            });
            this.needToBeUpdated = false;
        } else {
            this.needToBeUpdated = true;
        }
    }

    checkUpdate(){
        if (this.needToBeUpdated){
            this.drawMarks();
            this.drawScroll();
        }
    }

    onMouseMove(event:MouseEvent){
        let rate        = this.getHeight() / this.count,
            position    = event.layerY / rate,
            offset      = this.count * 0.10,
            limit       = 10;
        if (this.marks.length > 0){
            offset = offset <= 0 ? 1 : (offset > 100 ? 100 : offset);
            this.selection.list = [];
            this.selection.top  = event.layerY + 'px';
            this.marks.forEach((mark: ListLineMark)=>{
                if (limit >= this.selection.list.length){
                    if (mark.position > (position - offset) && mark.position < (position + offset)){
                        this.selection.list.push({
                            html    : mark.str,
                            onClick : mark.onClick
                        });
                    }
                }
            });
            this.forceUpdate();
        }
    }

    onClick(event: MouseEvent){
        let rate        = event.layerY / this.getHeight(),
            position    = Math.ceil(this.count * rate);
        this.scrollTo.emit(position);
    }

    onMouseLeave(){
        this.selection.list = [];
    }

    ngAfterContentChecked(){
        this.setupContext();
        this.setupSize();
        this.checkUpdate();
    }

    ngOnChanges(){
        this.clearDraw();
        this.resize(true);
        this.drawMarks();
        this.drawScroll();
    }

    onSelect(event : MouseEvent){
    }

    onScroll(event: MouseEvent){
        console.log(event);
    }

    forceUpdate(){
        this.changeDetectorRef.detectChanges();
    }

    getTopOffset(){
        return this.offsetTop + 'px';
    }

    getHeight(height?: number){
        return ((typeof height === 'number' ? height : this.size.height) - this.offsetTop - this.offsetBottom)
    }

    getScrollHeight(){
        return (this.scroll !== null ? this.scroll.scrollHeight : 0) + 'px';
    }
}
