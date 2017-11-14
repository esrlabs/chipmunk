import {
    Component, ElementRef, Input, Output, AfterViewChecked, ChangeDetectorRef, ViewChildren, ViewContainerRef,
    QueryList, ViewChild, EventEmitter, Compiler
} from '@angular/core';

import { OnScrollEvent } from './interface.scrollevent';

const SETTINGS = {
    END_SCROLL_OFFSET   : 100,//px
    BEGIN_SCROLL_OFFSET : 100,//px
};

@Component({
    selector    : 'long-list',
    templateUrl : './template.html',
})

export class LongList implements AfterViewChecked{
    @ViewChildren   ('li',      { read: ViewContainerRef}) li:      QueryList<ViewContainerRef>;
    @ViewChild      ('ul',      { read: ViewContainerRef}) ul:      ViewContainerRef;
    @ViewChild      ('wrapper', { read: ViewContainerRef}) wrapper: ViewContainerRef;

    /*
    * Incomes declaration
    * */
    @Input() rows       : Array<any>                    = [];
    @Input() cssClass   : string                        = '';
    @Input() onScroll   : EventEmitter<OnScrollEvent>   = new EventEmitter();


    private GUID : string = '';

    /*
    * Internal declaration
    * */
    private component : {
        node            : HTMLElement,
        height          : number,
        expectedHeight  : number,
        filler          : string,
        ref             : ChangeDetectorRef
    } = {
        node            : null,
        height          : 0,
        expectedHeight  : 0,
        filler          : '',
        ref             : null
    };

    private state : {
        rows        : Array<any>,
        start       : number,
        distance    : number,
        end         : number,
        ready       : boolean,
        offset      : string,
        buffer      : number,
        scrollTop   : number,
        count       : number
    } = {
        rows        : [],
        start       : 0,
        distance    : 0,
        end         : 1,
        ready       : false,
        offset      : '',
        buffer      : 10,
        scrollTop   : -1000,
        count       : -1
    };

    private row : {
        height  : number,
        node    : any,
        selector: string
    } = {
        height  : 0,
        node    : null,
        selector: 'li:first-child'
    };

    forceUpdate(){
        this.component.ref.detectChanges();
    }

    public update(recalculate: boolean = false){
        recalculate && this.forceCalculation();
        this.updateState();
        this.initRowNode();
        this.initRowSize();
        this.updateSize();
        this.checkCount();
        this.forceUpdate();
    }

    forceCalculation(){
        this.calculate(this.wrapper.element.nativeElement.scrollTop, true);
        this.state.rows.forEach((row)=>{
            typeof row.forceUpdate === 'function' && row.forceUpdate(row.params);
        });
    }

    checkCount(){
        if (this.rows.length !== this.state.count && this.state.count !== -1){
            let wrapper         = this.wrapper.element.nativeElement;
            //wrapper.scrollTop   = wrapper.scrollTop * (this.rows.length / this.state.count);
            this.calculate(wrapper.scrollTop, true);
            this.state.rows.forEach((row)=>{
                typeof row.forceUpdate === 'function' && row.forceUpdate(row.params);
            });
        }
        this.state.count = this.rows.length;
    }

    initRowNode(){
        if(this.row.node === null && this.li !== void 0 && this.li.length > 0){
            this.row.node = this.li.first.element.nativeElement;
        }
    }

    initRowSize(){
        if (this.row.node !== null && !this.state.ready){
            this.row.height = this.row.node.getBoundingClientRect().height;
            this.row.height > 0 && (this.state.ready = true);
            this.row.height > 0 && this.calculate(0);
            this.row.height > 0 && this.updateState();
            this.row.height > 0 && this.forceUpdate();
        }
    }

    updateSize(){
        this.component.height = this.component.node.getBoundingClientRect().height;
    }

    updateState(){
        this.state.rows = this.rows.slice(this.state.start, this.state.end);
    }

    calculate(scrollTop : number , force: boolean = false){
        if (force || (scrollTop !== this.state.scrollTop && Math.abs(scrollTop - this.state.scrollTop) >= this.row.height)){
            let start               = Math.floor(scrollTop / this.row.height),
                height              = this.row.height * this.rows.length;
            this.component.height === 0 && this.updateSize();
            start                           = start < 0 ? 0 : (start > height ? 0 : start);
            this.state.scrollTop            = scrollTop > height ? height : scrollTop;
            this.state.start                = this.state.buffer > start ? start : (start - this.state.buffer);
            this.state.distance             = Math.ceil(this.component.height / this.row.height) + this.state.buffer * 2;
            this.state.end                  = this.state.start + this.state.distance;
            this.component.filler           = height + 'px';
            this.state.offset               = this.state.scrollTop - (start < this.state.buffer ? 0 : (this.state.buffer * this.row.height)) + 'px';
            this.component.expectedHeight   = height;

        }
    }

    onScrollEvent(event : Event | any){
        let scrollEvent : OnScrollEvent = {
            scrollHeight        : event.target.scrollHeight,
            scrollTop           : event.target.scrollTop,
            viewHeight          :this.component.height,
            isScrolledToBegin   : false,
            isScrolledToEnd     : false
        };
        this.calculate(event.target.scrollTop, false);
        this.updateState();
        if (event.target.scrollHeight > this.component.height){
            if ((event.target.scrollTop + this.component.height) >= this.component.expectedHeight - SETTINGS.END_SCROLL_OFFSET){
                scrollEvent.isScrolledToEnd = true;
            }
        }
        if (event.target.scrollTop <= SETTINGS.BEGIN_SCROLL_OFFSET){
            scrollEvent.isScrolledToBegin = true;
        }
        this.onScroll.emit(scrollEvent);
    }

    getScrollState(){
        let scrollEvent : OnScrollEvent = {
            scrollHeight        : this.wrapper.element.nativeElement.scrollHeight,
            scrollTop           : this.wrapper.element.nativeElement.scrollTop,
            viewHeight          : this.component.height,
            isScrolledToBegin   : false,
            isScrolledToEnd     : false
        };
        return scrollEvent;
    }

    onResize(){
        this.component.height = this.component.node.getBoundingClientRect().height;
        this.calculate(this.state.scrollTop, true);
        this.updateState();
    }

    public scrollToIndex(index: number){
        let wrapper = this.wrapper.element.nativeElement;
        wrapper.scrollTop = this.row.height * index;
        this.calculate(wrapper.scrollTop);
        this.updateState();
    }

    constructor(private element     : ElementRef,
                private ref         : ChangeDetectorRef,
                private viewRef     : ViewContainerRef,
                private compiler    : Compiler
    ) {
        this.component.node = element.nativeElement;
        this.component.ref  = ref;
    }

    ngAfterViewChecked(){
        this.update();
    }

}
