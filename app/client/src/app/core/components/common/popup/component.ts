import {Component, Input, OnInit, EventEmitter, Output, ViewContainerRef, ViewChild} from '@angular/core';
import { Parameters         } from './interface';

const Directions = {
    T   : Symbol(),
    R   : Symbol(),
    B   : Symbol(),
    L   : Symbol(),
    TL  : Symbol(),
    TR  : Symbol(),
    BR  : Symbol(),
    BL  : Symbol()
};

interface Position{
    top     : number,
    left    : number
}

interface Size{
    width : number,
    height: number
}

@Component({
    selector    : 'popup',
    templateUrl : './template.html',
})

export class Popup implements OnInit{
    @Input()    parameters  : Parameters;
    @Output()   closer      : EventEmitter<any> = new EventEmitter();

    @ViewChild('placeholder', { read: ViewContainerRef}) placeholder: ViewContainerRef;

    protected defaults = {
        close           : true,
        addCloseHandle  : true,
        css             : '',
        move            : true,
        resize          : true,
        width           : '20rem',
        height          : '10rem'
    };

    private position    : Position  = { top     : 0, left   : 0 };
    private size        : Size      = { width   : 100, height : 100 };
    private state       : {
        moving      : boolean,
        resizing    : boolean,
        direction   : any,
        x           : number,
        y           : number
    } = {
        moving      : false,
        resizing    : false,
        direction   : null,
        x           : -1,
        y           : -1
    };

    constructor(private viewContainerRef : ViewContainerRef) {
        window.addEventListener('mousemove',    this.onMove.bind(this));
        window.addEventListener('mouseup',      this.onMouseUp.bind(this));
    }

    ngOnInit(){
        this.validateSettings();
        this.validateTitleButtons();
        this.validateButtons();
        this.defaultPosition();
        this.attachContent();
    }

    validateSetting(setting : string){
        this.parameters.settings[setting] = this.parameters.settings[setting] === void 0 ? this.defaults[setting] : this.parameters.settings[setting];
    }

    validateSettings(){
        this.parameters.settings = this.parameters.settings === void 0 ? Object.assign({}, this.defaults) : this.parameters.settings;
        Object.keys(this.defaults).forEach((setting)=>{
            this.validateSetting(setting);
        });
    }

    validateButtons(){
        this.parameters.buttons = this.parameters.buttons === void 0 ? [] : this.parameters.buttons;
        this.parameters.buttons = this.parameters.buttons.map((button)=>{
            button.handle = typeof button.handle === 'function' ? button.handle : function () {};
            this.parameters.settings.addCloseHandle && (button.handle = function(handle : Function) {
                this.close();
                handle();
            }.bind(this, button.handle));
            return button;
        });
    }

    validateTitleButtons(){
        this.parameters.titlebuttons = this.parameters.titlebuttons === void 0 ? [] : this.parameters.titlebuttons;
        if (this.parameters.settings.close){
            this.parameters.titlebuttons.push({
                icon    : 'fa-close',
                hint    : 'close',
                handle  : this.close.bind(this)
            });
        }
        this.parameters.titlebuttons = this.parameters.titlebuttons.map((button)=>{
            button.handle = typeof button.handle === 'function' ? button.handle : function () {};
            this.parameters.settings.addCloseHandle && (button.handle = function(handle : Function) {
                this.close();
                handle();
            }.bind(this, button.handle));
            return button;
        });
    }

    attachContent(){
        let component   = this.placeholder.createComponent(this.parameters.content.factory),
            closer      = 'closer';
        if (typeof this.parameters.content.params === 'object' && this.parameters.content.params !== null){
            Object.keys(this.parameters.content.params).forEach((key)=>{
                component.instance[key] = this.parameters.content.params[key];
            });
        }
        if(component.instance[closer] !== void 0){
            component.instance[closer].subscribe(()=>{
                component.destroy();
            });
        }
    }

    close(){
        this.closer.emit();
    }

    defaultPosition(){
        function setValue(prop: string){
            if (typeof this.parameters.settings[prop] === 'number'){
                this.size[prop] = this.parameters.settings[prop];
            } else if (typeof this.parameters.settings[prop] === 'string' && ~this.parameters.settings[prop].indexOf('%')){
                this.size[prop] = (parseInt(this.parameters.settings[prop], 10) / 100) * size[prop];
            } else if (typeof this.parameters.settings[prop] === 'string' && ~this.parameters.settings[prop].indexOf('em')){
                let em = parseFloat(getComputedStyle(this.viewContainerRef.element.nativeElement).fontSize)
                this.size[prop] = parseInt(this.parameters.settings[prop], 10) * em;
            }
        }
        let size = this.viewContainerRef.element.nativeElement.getBoundingClientRect();
        setValue.call(this, 'height');
        setValue.call(this, 'width');
        this.position.top   = size.height / 2 - this.size.height / 2;
        this.position.left  = size.width / 2 - this.size.width / 2;
    }

    grabCoordinates(event : MouseEvent){
        return {
            x : event.screenX,
            y : event.screenY
        };
    }

    onMove(event : MouseEvent){
        if (this.state.moving || this.state.resizing){
            let coord = this.grabCoordinates(event);
            if (coord.x !== this.state.x || coord.y !== this.state.y){
                if(this.state.moving){
                    //Moving
                    this.position.top   -= this.state.y - coord.y;
                    this.position.left  -= this.state.x - coord.x;
                } else {
                    //Resizing
                    switch (this.state.direction){
                        case Directions.T:
                            this.position.top   -= this.state.y - coord.y;
                            this.size.height    += this.state.y - coord.y;
                            break;
                        case Directions.R:
                            this.size.width     -= this.state.x - coord.x;
                            break;
                        case Directions.B:
                            this.size.height    -= this.state.y - coord.y;
                            break;
                        case Directions.L:
                            this.position.left  -= this.state.x - coord.x;
                            this.size.width     += this.state.x - coord.x;
                            break;
                        case Directions.TL:
                            this.position.top   -= this.state.y - coord.y;
                            this.size.height    += this.state.y - coord.y;
                            this.position.left  -= this.state.x - coord.x;
                            this.size.width     += this.state.x - coord.x;
                            break;
                        case Directions.TR:
                            this.position.top   -= this.state.y - coord.y;
                            this.size.height    += this.state.y - coord.y;
                            this.size.width     -= this.state.x - coord.x;
                            break;
                        case Directions.BR:
                            this.size.height    -= this.state.y - coord.y;
                            this.size.width     -= this.state.x - coord.x;
                            break;
                        case Directions.BL:
                            this.size.height    -= this.state.y - coord.y;
                            this.position.left  -= this.state.x - coord.x;
                            this.size.width     += this.state.x - coord.x;
                            break;
                    }
                }
                this.state.x = coord.x;
                this.state.y = coord.y;
            }
        }
    }

    onMouseDownTitle(event: MouseEvent){
        if (this.parameters.settings.move){
            let coord           = this.grabCoordinates(event);
            this.state.moving   = true;
            this.state.x        = coord.x;
            this.state.y        = coord.y;
        }
    }

    onMouseUp(event: MouseEvent){
        this.state.moving   = false;
        this.state.resizing = false;
    }

    onResize(event:MouseEvent, direction: any){
        if (this.parameters.settings.resize){
            let coord               = this.grabCoordinates(event);
            this.state.resizing     = true;
            this.state.direction    = direction;
            this.state.x            = coord.x;
            this.state.y            = coord.y;
        }
    }

    onResizeT(event:MouseEvent){
        this.onResize(event, Directions.T);
    }
    onResizeR(event:MouseEvent){
        this.onResize(event, Directions.R);
    }
    onResizeB(event:MouseEvent){
        this.onResize(event, Directions.B);
    }
    onResizeL(event:MouseEvent){
        this.onResize(event, Directions.L);
    }
    onResizeTL(event:MouseEvent){
        this.onResize(event, Directions.TL);
    }
    onResizeTR(event:MouseEvent){
        this.onResize(event, Directions.TR);
    }
    onResizeBR(event:MouseEvent){
        this.onResize(event, Directions.BR);
    }
    onResizeBL(event:MouseEvent){
        this.onResize(event, Directions.BL);
    }
}
