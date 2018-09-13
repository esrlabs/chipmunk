import {
    Component, ElementRef, Input, Output, OnDestroy, AfterViewChecked, ChangeDetectorRef, ViewChildren, ViewContainerRef,
    QueryList, ViewChild, EventEmitter, Compiler
} from '@angular/core';

import { OnScrollEvent } from './interface.scrollevent';
import {events as Events} from "../../../modules/controller.events";
import {configuration as Configuration} from "../../../modules/controller.config";
import { GUID } from "../../../modules/tools.guid";

const SETTINGS = {
    END_SCROLL_OFFSET   : 0,//px
    BEGIN_SCROLL_OFFSET : 0,//px
    FILLER_OFFSET       : 16,
    SCROLL_BAR_OFFSET   : 15,
    BORDER_TIMEOUT      : 500,
    BORDER_ATTEMPTS     : 10,
    SCROLL_TOP_OFFSET   : 15
};

export type TSelection = { start: number, end: number, startText: string, endText: string, startOffset: number, endOffset: number};

@Component({
    selector    : 'long-list',
    templateUrl : './template.html',
})

export class LongList implements AfterViewChecked, OnDestroy {
    @ViewChildren   ('li',      { read: ViewContainerRef}) li:      QueryList<ViewContainerRef>;
    @ViewChild      ('ul',      { read: ViewContainerRef}) ul:      ViewContainerRef;
    @ViewChild      ('wrapper', { read: ViewContainerRef}) wrapper: ViewContainerRef;

    /*
    * Incomes declaration
    * */
    @Input() rows               : Array<any>                    = [];
    @Input() maxWidthRow?       : any                           = null;
    @Input() cssClass           : string                        = '';
    @Input() onScroll           : EventEmitter<OnScrollEvent>   = new EventEmitter();
    @Input() onSelection        : EventEmitter<TSelection>      = new EventEmitter<TSelection>();
    @Input() onSelectionStarted : EventEmitter<void>            = new EventEmitter<void>();

    /*
    * Internal declaration
    * */
    private guid: string = GUID.generate();

    private component : {
        node            : HTMLElement,
        height          : number,
        maxScrollTop    : number,
        topOffset       : number,
        expectedHeight  : number,
        filler          : string,
        ref             : ChangeDetectorRef
    } = {
        node            : null,
        height          : 0,
        maxScrollTop    : 0,
        topOffset       : 15,
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
        count       : number,
        previousST  : number
    } = {
        rows        : [],
        start       : 0,
        distance    : 0,
        end         : 1,
        ready       : false,
        offset      : '',
        buffer      : 10,
        scrollTop   : -1000,
        count       : -1,
        previousST  : -1
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

    private borders : {
        top             : boolean,
        bottom          : boolean,
        bottomCSSClass  : string,
        topCSSClass     : string,
        bottomPosition  : string,
        timer           : any,
        counter         : number,
        left            : string,
        previousST      : number
    } = {
        top             : false,
        bottom          : false,
        bottomCSSClass  : '',
        topCSSClass     : '',
        bottomPosition  : '10000px',
        timer           : -1,
        counter         : 0,
        left            : '0px',
        previousST      : 0
    };

    private previousSL: number = -1;

    private focused: boolean = false;

    private selection: {
        selecting: boolean,
        start: number,
        end: number,
        startSel: string,
        endSel: string,
        startFloadId: string,
        startOffset: number,
        endFloadId: string,
        endOffset: number,
        startRows: { first: string, last: string, hash: string },
        endRows: { first: string, last: string, hash: string }
    } = {
        selecting: false,
        start: -1,
        end: -1,
        startSel: '',
        endSel: '',
        startFloadId: '',
        startOffset: 0,
        endFloadId: '',
        endOffset: 0,
        startRows: { first: '', last: '', hash: '' },
        endRows: { first: '', last: '', hash: '' }
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
            this.calculate(wrapper.scrollTop, true, true);
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
        let height = this.row.height * this.rows.length;
        this.component.height       = this.component.node.getBoundingClientRect().height;
        this.component.maxScrollTop = height - this.component.height + SETTINGS.SCROLL_BAR_OFFSET;
        this.borders.bottomPosition = (height - 40) + 'px';
    }

    updateState(){
        this.state.rows = this.rows.slice(this.state.start, this.state.end);
    }

    checkBorders(scrollTop: number, scrollLeft: number){
        if (scrollTop === this.borders.previousST) {
            this.borders.counter += 1;
            if (this.borders.counter  > SETTINGS.BORDER_ATTEMPTS) {
                this.borders.counter = 0;
                if (scrollTop === SETTINGS.SCROLL_TOP_OFFSET || Math.abs(scrollTop - this.component.maxScrollTop) <= 1){
                    this.borders.timer !== -1 && clearTimeout(this.borders.timer);
                    this.borders.timer = setTimeout(this.offBorders.bind(this), SETTINGS.BORDER_TIMEOUT);
                }
                if (scrollTop === SETTINGS.SCROLL_TOP_OFFSET) {
                    this.borders.top    = true;
                    this.borders.bottom = false;
                    this.onBorders();
                } else if (Math.abs(scrollTop - this.component.maxScrollTop) <= 1){
                    this.borders.top    = false;
                    this.borders.bottom = true;
                    this.onBorders();
                }
            }
        } else {
            this.borders.counter = 0;
        }
        this.borders.left = scrollLeft + 'px';
        this.borders.previousST = scrollTop;
    }

    onBorders(){
        this.borders.timer !== -1 && clearTimeout(this.borders.timer);
        this.borders.bottomCSSClass = 'on';
        this.borders.topCSSClass    = 'on';
        this.borders.timer = setTimeout(this.offBorders.bind(this), SETTINGS.BORDER_TIMEOUT);
        this.forceUpdate();
    }

    offBorders(){
        this.borders.timer !== -1 && clearTimeout(this.borders.timer);
        this.borders.bottomCSSClass = 'off';
        this.borders.topCSSClass    = 'off';
        this.borders.timer = setTimeout(this.resetBorders.bind(this), SETTINGS.BORDER_TIMEOUT);
        this.forceUpdate();
    }

    resetBorders(){
        this.borders.top            = false;
        this.borders.bottom         = false;
        this.borders.bottomCSSClass = '';
        this.borders.topCSSClass    = '';
        this.borders.timer          = -1;
        this.borders.counter        = 0;
    }

    calculate(scrollTop : number, force: boolean = false, noOffsetChange: boolean = false){
        if (force || (scrollTop !== this.state.scrollTop /*&& Math.abs(scrollTop - this.state.scrollTop) >= this.row.height*/)){
            let start               = Math.floor((scrollTop - SETTINGS.SCROLL_TOP_OFFSET) / this.row.height),
                height              = this.row.height * this.rows.length,
                rendered            = 0,
                offset              = 0;
            this.component.height === 0 && this.updateSize();
            start                           = start < 0 ? 0 : (start > height ? 0 : start);
            this.state.scrollTop            = scrollTop > height ? height : scrollTop;
            this.state.start                = this.state.buffer > start ? start : (start - this.state.buffer);
            this.state.distance             = Math.ceil(this.component.height / this.row.height) + this.state.buffer * 2;
            this.state.end                  = this.state.start + this.state.distance;
            this.component.filler           = (height + SETTINGS.FILLER_OFFSET)+ 'px';
            if (!noOffsetChange){
                offset                          = this.state.scrollTop - (start < this.state.buffer ? 0 : (this.state.buffer * this.row.height));
                rendered                        = (this.state.end > this.rows.length ? this.rows.length : this.state.end) - this.state.start;
                if (this.row.height * rendered + offset > height){
                    offset = offset - ((this.row.height * rendered + offset) - height);
                }
                this.state.offset               = offset - SETTINGS.SCROLL_TOP_OFFSET + 'px';
            }
            this.component.expectedHeight   = height;
        }
    }

    setFocus() {
        this.focused = true;
    }

    unsetFocus() {
        this.focused = false;
    }

    onScrollEvent(event : Event | any) {
        const horizontalScroll = (event.target.scrollLeft !== this.previousSL);
        this.previousSL = event.target.scrollLeft;
        //Correction of bottom scroll
        if ((event.target.scrollTop + this.component.height ) > this.row.height * this.rows.length && event.target.scrollTop > this.state.previousST){
            event.target.scrollTop = this.component.maxScrollTop;
        } else if ((event.target.scrollTop + this.component.height) > this.row.height * this.rows.length && event.target.scrollTop < this.state.previousST){
            this.offBorders();
        }
        //Correction of top scroll
        if (event.target.scrollTop < SETTINGS.SCROLL_TOP_OFFSET){
            event.target.scrollTop = (this.state.distance > this.rows.length - 1) ? 0 : SETTINGS.SCROLL_TOP_OFFSET;
        }

        this.state.previousST = event.target.scrollTop;

        let scrollEvent : OnScrollEvent = {
            scrollHeight        : event.target.scrollHeight,
            scrollTop           : event.target.scrollTop,
            viewHeight          : this.component.height,
            isScrolledToBegin   : false,
            isScrolledToEnd     : false
        };
        //Check border
        !horizontalScroll && this.checkBorders(scrollEvent.scrollTop, event.target.scrollLeft);
        //Make calculation
        this.calculate(event.target.scrollTop, false);
        this.updateState();
        if (event.target.scrollHeight > this.component.height){
            if ((event.target.scrollTop + this.component.height) >= this.component.expectedHeight){
                scrollEvent.isScrolledToEnd = true;
            }
        }
        if (event.target.scrollTop <= SETTINGS.BEGIN_SCROLL_OFFSET){
            scrollEvent.isScrolledToBegin = true;
        }
        this.onScroll.emit(scrollEvent);
        this.checkSelection();
        this.restoreSelection(true);
    }

    onWindowClick(event: MouseEvent) {
        const parent = this.findParentByAttr(event.target as HTMLElement, 'data-com-el-id');
        if (parent === null) {
            return this.unsetFocus();
        }
        const guid = parent.getAttribute('data-com-el-id');
        if (this.guid !== guid) {
            return this.unsetFocus();
        }
        this.setFocus();
    }

    getScrollState(){
        const nativeElement = this.wrapper.element.nativeElement;
        const scrollEvent : OnScrollEvent = {
            scrollHeight        : nativeElement.scrollHeight,
            scrollTop           : nativeElement.scrollTop,
            viewHeight          : this.component.height,
            isScrolledToBegin   : nativeElement.scrollTop <= SETTINGS.BEGIN_SCROLL_OFFSET,
            isScrolledToEnd     : nativeElement.scrollHeight > this.component.height ? ((nativeElement.scrollTop + this.component.height) >= this.component.expectedHeight) : false
        };
        return scrollEvent;
    }

    onResize(){
        this.component.height = this.component.node.getBoundingClientRect().height;
        this.calculate(this.state.scrollTop, true);
        this.updateState();
    }

    onMouseDown(event: MouseEvent){
        this.setFocus();
        //Is on selected node
        if (this.selection.start !== -1 && this.selection.end !== -1) {
            if (this.isNodeInSelection(event.target as HTMLElement) && event.which !== 1) {
                //This is context menu call.
                return;
            }
        }
        if (this.selection.start === -1 && this.selection.end === -1) {
            this.dropSelection(true);
        }
        if (!this.selection.selecting && this.selection.start !== -1) {
            this.dropSelection(true);
        }
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.DENY_SELECTION_ON_BODY);
        //Get wrapper node
        const target = this.findParentByAttr(event.target as HTMLElement, 'data-ll-row-index');
        if (target === null) {
            return;
        }
        this.selection.selecting = true;
        this.selection.start = parseInt(target.getAttribute('data-ll-row-index'));
        this.onSelectionStarted.emit();

    }

    onMouseMove(event: MouseEvent){
        if (!this.selection.selecting) {
            return true;
        }
        this.getSelectionBorders();
    }

    onMouseUp(event: MouseEvent){
        //Is on selected node
        if (this.selection.start !== -1 && this.selection.end !== -1) {
            if ((this.isNodeInSelection(event.target as HTMLElement) && event.which !== 1) || this.findParentByAttr(event.target as HTMLElement, 'data-context-menu') !== null) {
                //This is context menu call.
                return;
            }
        }
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.ALLOW_SELECTION_ON_BODY);
        if (window.getSelection().toString() === '') {
            this.dropSelection();
            return this.onSelection.emit(this.getSelection());
        }
        this.checkSelection();
        if (!this.selection.selecting) {
            this.dropSelection();
            return this.onSelection.emit(this.getSelection());
        }
        this.selection.selecting = false;
        if (this.selection.startFloadId === '') {
            this.dropSelection();
            return this.onSelection.emit(this.getSelection());
        }
        const selection = window.getSelection();
        let float = this.findParentByAttr(selection.focusNode as HTMLElement, 'data-float-id');
        let target = this.findParentByAttr(event.target as HTMLElement, 'data-ll-row-index');
        if (float === null && target !== null) {
            float = this.findChildByAttr(target  as HTMLElement, 'data-float-id');
        }
        if (float === null || target === null) {
            this.dropSelection(true);
            return this.onSelection.emit(this.getSelection());
        }
        this.selection.endFloadId = float.getAttribute('data-float-id');
        this.selection.endOffset = selection.focusOffset;
        this.selection.end = parseInt(target.getAttribute('data-ll-row-index'));
        if (this.selection.end === this.selection.start) {
            this.selection.startSel = selection.toString();
            this.selection.endSel = '';
        } else {
            this.getSelectionBorders();
        }
        this.setSelectionBorderText();
        this.reverseSelection();
        return this.onSelection.emit(this.getSelection());
    }

    @Output() getSelection(): TSelection | null {
        if (this.selection.start === -1) {
            return null;
        }
        return {
            start: this.selection.start,
            end: this.selection.end,
            startText: this.selection.startSel,
            endText: this.selection.endSel,
            startOffset: this.selection.startOffset,
            endOffset: this.selection.endOffset
        }
    }

    @Output() selectAll() {
        this.dropSelection(true);
        this.selection.start = 0;
        this.selection.end = this.rows.length - 1;
        this.restoreSelection(true);
    }

    @Output() isFocused() {
        return this.focused;
    }

    @Output() refreshSelection() {
        this.restoreSelection();
    }

    @Output() removeSelection() {
        this.dropSelection(true);
    }

    getSelectionBorders(){
        if (!this.selection.selecting || this.selection.start === -1) {
            return;
        }
        const selection = window.getSelection();
        const selectedText = selection.toString();
        if (selectedText === '') {
            return;
        }
        const nodes = {
            start: this.findParentByAttr(selection.anchorNode as HTMLElement, 'data-ll-row-index'),
            end: this.findParentByAttr(selection.focusNode as HTMLElement, 'data-ll-row-index')
        };
        const content = {
            start: nodes.start !== null ? nodes.start.innerText : '',
            end: nodes.end !== null ? nodes.end.innerText : ''
        };
        const indexes = {
            start: nodes.start !== null ? parseInt(nodes.start.getAttribute('data-ll-row-index')) : -1,
            end: nodes.end !== null ? parseInt(nodes.end.getAttribute('data-ll-row-index')) : -1,
        };
        if (indexes.start === -1 && indexes.end === -1) {
            return;
        }
        const rows = selectedText.split(/[\n\r]/gi);
        const availability = {
            start: indexes.start === this.selection.start && (content.start.indexOf(rows[0]) !== -1 || content.start.indexOf(rows[rows.length -1]) !== -1),
            end: indexes.end !== -1
        };
        if (availability.start){
            this.selection.startRows.first = rows[0];
            this.selection.startRows.last = rows[rows.length -1];
        }
        if (availability.end){
            this.selection.endRows.first = rows[0];
            this.selection.endRows.last = rows[rows.length -1];
            this.selection.end = indexes.end;
            this.selection.endOffset = selection.focusOffset;
            let float = this.findParentByAttr(selection.focusNode as HTMLElement, 'data-float-id');
            float !== null && (this.selection.endFloadId = float.getAttribute('data-float-id'));
        }
    }

    setSelectionBorderText(){
        if (this.selection.start === -1 && this.selection.end === -1) {
            return;
        }
        if (this.selection.start < this.selection.end) {
            //Selection forward
            this.selection.startSel = this.selection.startRows.first;
            this.selection.endSel = this.selection.endRows.last;
        } else {
            //Selection backwards
            this.selection.startSel = this.selection.startRows.last;
            this.selection.endSel = this.selection.endRows.first;
        }
    }

    reverseSelection(){
        if (this.selection.start === -1) {
            return;
        }
        if (this.selection.start < this.selection.end) {
            return;
        }
        const copy = Object.assign({}, this.selection);
        if (this.selection.start === this.selection.end) {
            this.selection.startOffset = copy.startOffset < copy.endOffset ? copy.startOffset : copy.endOffset;
            this.selection.endOffset = copy.startOffset > copy.endOffset ? copy.startOffset : copy.endOffset;
        } else {
            this.selection.start = copy.end;
            this.selection.startFloadId = copy.endFloadId;
            this.selection.startOffset = copy.endOffset;
            this.selection.startSel = copy.endSel;
            this.selection.end = copy.start;
            this.selection.endFloadId = copy.startFloadId;
            this.selection.endOffset = copy.startOffset;
            this.selection.endSel = copy.startSel;
        }
    }

    dropSelection(hard: boolean = false){
        this.selection.selecting = false;
        this.selection.start = -1;
        this.selection.end = -1;
        this.selection.startSel = '';
        this.selection.endSel = '';
        this.selection.startFloadId = '';
        this.selection.startOffset = 0;
        this.selection.endFloadId = '';
        this.selection.endOffset = 0;
        this.selection.startRows = { first: '', last: '', hash: '' };
        this.selection.endRows = { first: '', last: '', hash: '' };
        if (hard) {
            window.getSelection().removeAllRanges();
        }
    }

    checkSelection(){
        if (!this.selection.selecting) {
            return;
        }
        const ulNode = this.ul.element.nativeElement;
        //Detect startSel node
        const startNode = ulNode.querySelector(`li[data-ll-row-index="${this.selection.start}"]`);
        //Get current selection
        const selection = window.getSelection();
        //Check float id of start
        if (this.selection.startFloadId === '') {
            let target = this.findParentByAttr(selection.anchorNode as HTMLElement, 'data-float-id');
            if (target === null && startNode !== null) {
                target = this.findChildByAttr(startNode, 'data-float-id')
            }
            if (target !== null) {
                this.selection.startFloadId = target.getAttribute('data-float-id');
                this.selection.startOffset = selection.anchorOffset;
            }
        }
        this.getSelectionBorders();
    }

    getRealRenderedBorders(){
        const ulNode = this.ul.element.nativeElement;
        const rendered = {
            start: ulNode.querySelector(`li:nth-child(2)`),
            end: ulNode.querySelector(`li:last-child`)
        };
        return {
            start: rendered.start !== null ? parseInt(rendered.start.getAttribute('data-ll-row-index')) : -1,
            end: rendered.end !== null ? parseInt(rendered.end.getAttribute('data-ll-row-index')) : -1,
        }
    }

    restoreSelection(force: boolean = false){
        if (this.selection.start === -1) {
            return;
        }
        if (!force && this.selection.selecting) {
            return;
        }
        const selection = window.getSelection();
        //Check is this selection "about" this instance of component or not
        if (selection.anchorNode !== null || selection.focusNode !== null) {
            const parent = this.findParentByAttr(
                (selection.anchorNode !== null ? selection.anchorNode : selection.focusNode) as HTMLElement,
                'data-com-el-id'
            );
            if (parent === null) {
                return false;
            }
            const guid = parent.getAttribute('data-com-el-id');
            if (this.guid !== guid) {
                return false;
            }
        }
        const ulNode = this.ul.element.nativeElement;
        const borders = this.getRealRenderedBorders();
        if (borders.start === -1 || borders.end === -1) {
            return;
        }
        //Reverse data if needed
        const reverse = this.selection.start > this.selection.end;
        let start = !reverse ? this.selection.start : this.selection.end;
        let end = reverse ? this.selection.start : this.selection.end;
        const startFloadId = !reverse ? this.selection.startFloadId : this.selection.endFloadId;
        const endFloadId = reverse ? this.selection.startFloadId : this.selection.endFloadId;
        const startOffset = !reverse ? this.selection.startOffset : this.selection.endOffset;
        const endOffset = reverse ? this.selection.startOffset : this.selection.endOffset;

        const rendered = {
            start: ulNode.querySelector(`li[data-ll-row-index="${start}"]`) !== null ? start : borders.start,
            end: ulNode.querySelector(`li[data-ll-row-index="${end}"]`) !== null ? end : borders.end
        };

        if (end < rendered.start || start > rendered.end) {
            return;
        }

        //Process single line selection
        if (start === end) {
            //Try to find node with selection
            const selectedNode = this.findChildByInnerText(ulNode.querySelector(`li[data-ll-row-index="${start}"]`), this.selection.startSel);
            if (selectedNode !== null) {
                selection.removeAllRanges();
                const range = document.createRange();
                range.selectNode(selectedNode);
                selection.addRange(range);
                return;
            }
            //Selected node wasn't find. Try regular way.
        }
        start = start < rendered.start ? rendered.start : start;
        end = end > rendered.end ? rendered.end : end;
        //Try find original start and end nodes
        let startNode = ulNode.querySelector(`*[data-float-id="${startFloadId}"]`);
        let endNode = ulNode.querySelector(`*[data-float-id="${endFloadId}"]`);
        const startOriginal =  startNode !== null;
        const endOriginal = endNode !== null;
        startNode = startNode !== null ? this.getTextNodeOf(startNode as HTMLElement) : ulNode.querySelector(`li[data-ll-row-index="${start}"]`);
        endNode = endNode !== null ? this.getTextNodeOf(endNode as HTMLElement) : ulNode.querySelector(`li[data-ll-row-index="${end}"]`);
        if (startNode === null || endNode === null) {
            selection.removeAllRanges();
            return;
        }
        try {
            if (!reverse) {
                selection.setPosition(startNode, startOriginal ? startOffset : 0);
                selection.extend(endNode, endOriginal ? endOffset : 0);
            } else {
                selection.setPosition(endNode, endOriginal ? endOffset : 0);
                selection.extend(startNode, startOriginal ? startOffset : 0);
            }
        } catch (e) {
            this.dropSelection(true);
            console.error(e.message);
        }
    }

    isNodeInSelection(node: HTMLElement): boolean{
        const target = this.findParentByAttr(node, 'data-ll-row-index');
        if (target === null) {
            return false;
        }
        const index = parseInt(target.getAttribute('data-ll-row-index'));
        if (index < this.selection.start || index > this.selection.end){
            return false;
        }
        return true;
    }

    getTextNodeOf(node: HTMLElement): HTMLElement{
        for (let i = 0; i < node.childNodes.length; i += 1) {
            if (node.childNodes[i].nodeType === Node.TEXT_NODE){
                return node.childNodes[i] as HTMLElement;
            }
        }
        return null;
    }

    findParentByAttr(node: HTMLElement, attr: string){
        if (node === null){
            return null;
        }
        let target = null;
        do {
            if (node.getAttribute === void 0 && node.parentNode !== null && node.parentNode !== void 0) {
                node = node.parentNode as HTMLElement;
                continue;
            }
            if (node.getAttribute === void 0) {
                break;
            }
            const value = node.getAttribute(attr);
            if (value === null || value === undefined) {
                node = node.parentNode as HTMLElement;
                if (node === null || node === undefined) {
                    break;
                }
                continue;
            }
            target = node;
            break;
        } while(target === null);
        return target;
    }

    findChildByAttr(node: HTMLElement, attr: string): HTMLElement | null {
        if (node.getAttribute === void 0 && (node.childNodes === void 0 || node.childNodes === null)) {
            return null;
        }
        if (node.getAttribute === void 0) {
            let target: HTMLElement = null;
            Array.prototype.forEach.call(node.childNodes, (child: HTMLElement) => {
                if (target === null) {
                    target = this.findChildByAttr(child as HTMLElement, attr);
                }
            });
            return target;
        }
        const value = node.getAttribute(attr);
        if (value === null || value === undefined) {
            let target: HTMLElement = null;
            Array.prototype.forEach.call(node.childNodes, (child: HTMLElement) => {
               if (target === null) {
                   target = this.findChildByAttr(child as HTMLElement, attr);
               }
            });
            return target;
        }
        if (node.childNodes === void 0 || node.childNodes === null) {
            return null;
        }
        return node;
    }

    findChildByInnerText(node: HTMLElement, value: string): HTMLElement | null {
        if (typeof node.innerText !== 'string' && (node.childNodes === void 0 || node.childNodes === null)) {
            return null;
        }
        if (typeof node.innerText !== 'string') {
            let target: HTMLElement = null;
            Array.prototype.forEach.call(node.childNodes, (child: HTMLElement) => {
                if (target === null) {
                    target = this.findChildByInnerText(child as HTMLElement, value);
                }
            });
            return target;
        }
        if (node.innerText === value) {
            return node;
        }
        if (node.childNodes !== void 0 && node.childNodes !== null) {
            let target: HTMLElement = null;
            Array.prototype.forEach.call(node.childNodes, (child: HTMLElement) => {
                if (target === null) {
                    target = this.findChildByInnerText(child as HTMLElement, value);
                }
            });
            return target;
        }
        return null;
    }

    public scrollToIndex(index: number){
        let wrapper = this.wrapper.element.nativeElement;
        let scrollTop = this.row.height * (index + 1);
        if (wrapper.scrollTop === scrollTop) {
            return false;
        }
        if (typeof wrapper.scrollTo === 'function') {
            wrapper.scrollTo(wrapper.scrollLeft, scrollTop);
        } else {
            wrapper.scrollTop = scrollTop;
        }
    }

    private ID: number;
    constructor(private element     : ElementRef,
                private ref         : ChangeDetectorRef,
                private viewRef     : ViewContainerRef,
                private compiler    : Compiler
    ) {
        this.component.node = element.nativeElement;
        this.component.ref  = ref;
        this.ID = Math.random();
        this.onMouseUp = this.onMouseUp.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onWindowClick = this.onWindowClick.bind(this);
        window.addEventListener('mouseup', this.onMouseUp);
        window.addEventListener('mousemove', this.onMouseMove);
        window.addEventListener('click', this.onWindowClick);
    }

    ngOnDestroy(){
        window.removeEventListener('mouseup', this.onMouseUp);
        window.removeEventListener('mousemove', this.onMouseMove);
        window.removeEventListener('click', this.onWindowClick);
    }

    ngAfterViewChecked(){
        this.update();
        this.restoreSelection();
    }

}
