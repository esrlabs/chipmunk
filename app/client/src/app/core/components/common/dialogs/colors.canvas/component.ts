import {Component, Input, ViewChild, ViewContainerRef, AfterContentInit, AfterViewChecked, AfterViewInit   } from '@angular/core';

@Component({
    selector    : 'colors-canvas-dialog',
    templateUrl : './template.html',
})

export class ColorsCanvasDialog {
    @Input() callback       : Function      = null;
    @ViewChild ('colorsbox',   { read: ViewContainerRef}) boxRef   : ViewContainerRef;
    @ViewChild ('colorsline',  { read: ViewContainerRef}) lineRef  : ViewContainerRef;

    public box : {
        width   : number,
        height  : number,
        context : CanvasRenderingContext2D,
        redraw  : boolean,
        color   : string
    } = {
        width   : 50,
        height  : 50,
        context : null,
        redraw  : true,
        color   : 'rgba(255, 0, 0, 1)'
    };

    public line : {
        width   : number,
        height  : number,
        context : CanvasRenderingContext2D,
        redraw  : boolean
    } = {
        width   : 10,
        height  : 50,
        context : null,
        redraw  : true
    };

    public size : {
        width   : number,
        height  : number,
    } = {
        width   : -1,
        height  : -1,
    };

    constructor(private viewContainerRef : ViewContainerRef) {
    }

    ngAfterViewChecked(){
        this.resize();
        this.applySizes();
        this.getContext();
        this.drawLine();
        this.drawBox();
    }

    getContext(){
        if (this.box.context === null || this.line.context === null){
            this.box.context    = this.boxRef.element.nativeElement.getContext('2d');
            this.line.context   = this.lineRef.element.nativeElement.getContext('2d');
        }
    }

    resize(){
        let size    = this.viewContainerRef.element.nativeElement.getBoundingClientRect(),
            box     = 0.8,
            redraw  = false;
        size.width  !== this.size.width     && (redraw = true);
        size.height !== this.size.height    && (redraw = true);
        if (redraw){
            this.box.width      = Math.round(size.width * box);
            this.line.width     = size.width - this.box.width;
            this.box.height     = size.height;
            this.line.height    = size.height;
            this.size.width     = size.width;
            this.size.height    = size.height;
            this.box.redraw     = redraw;
            this.line.redraw    = redraw;
        }
    }

    applySizes(){
        if (this.box.redraw || this.line.redraw){
            this.boxRef.element.nativeElement.width     = this.box.width;
            this.boxRef.element.nativeElement.height    = this.box.height;
            this.lineRef.element.nativeElement.width    = this.line.width;
            this.lineRef.element.nativeElement.height   = this.line.height;
        }
    }

    drawBox() {
        if (this.box.context !== null && this.box.redraw) {
            let grdWhite = this.box.context.createLinearGradient(0, 0, this.box.width, 0),
                grdBlack = this.box.context.createLinearGradient(0, 0, 0, this.box.height);
            this.box.context.fillStyle = this.box.color;
            this.box.context.fillRect(0, 0, this.box.width, this.box.height);
            grdWhite.addColorStop(0, 'rgba(255,255,255,1)');
            grdWhite.addColorStop(1, 'rgba(255,255,255,0)');
            this.box.context.fillStyle = grdWhite;
            this.box.context.fillRect(0, 0, this.box.width, this.box.height);
            grdBlack.addColorStop(0, 'rgba(0,0,0,0)');
            grdBlack.addColorStop(1, 'rgba(0,0,0,1)');
            this.box.context.fillStyle = grdBlack;
            this.box.context.fillRect(0, 0, this.box.width, this.box.height);
            this.box.redraw = false;
        }
    }

    drawLine(){
        if (this.line.context !== null && this.line.redraw) {
            let gradient    = this.line.context.createLinearGradient(0, 0, 0, this.line.height),
                steps       = ['rgba(255, 0, 0, 1)', 'rgba(255, 255, 0, 1)', 'rgba(0, 255, 0, 1)', 'rgba(0, 255, 255, 1)', 'rgba(0, 0, 255, 1)', 'rgba(255, 0, 255, 1)', 'rgba(255, 0, 0, 1)'],
                offset      = 1 / steps.length;
            steps.forEach((step, index)=>{
                gradient.addColorStop(offset * index, step);

            });
            this.line.context.rect(0, 0, this.line.width, this.line.height);
            this.line.context.fillStyle = gradient;
            this.line.context.fill();
            this.line.redraw = false;
        }
    }

    onChangeBasicColor(event: MouseEvent){
        if (this.line.context !== null){
            let px = this.line.context.getImageData(event.offsetX, event.offsetY, 1, 1).data;
            this.box.color  = 'rgba(' + px[0] + ',' + px[1] + ',' + px[2] + ',1)';
            this.box.redraw = true;
            this.drawBox();
            typeof this.callback === 'function' && this.callback(this.box.color);
        }
    }

    onSelectColor(event: MouseEvent){
        if (this.box.context !== null){
            let px = this.box.context.getImageData(event.offsetX, event.offsetY, 1, 1).data;
            typeof this.callback === 'function' && this.callback('rgba(' + px[0] + ',' + px[1] + ',' + px[2] + ',1)');
        }
    }
}
