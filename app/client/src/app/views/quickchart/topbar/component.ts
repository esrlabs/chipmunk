/*global _*/
import { Component, ChangeDetectorRef, AfterContentInit, ViewChild, Input } from '@angular/core';
import { events as Events               } from '../../../core/modules/controller.events';
import { configuration as Configuration } from '../../../core/modules/controller.config';
import { CommonInput                    } from '../../../core/components/common/input/component';
import { localSettings, KEYs            } from '../../../core/modules/controller.localsettings';

@Component({
    selector    : 'topbar-quickchart',
    templateUrl : './template.html',
})

export class ViewControllerQuickchartBar implements AfterContentInit{

    @ViewChild('input') input : CommonInput;

    @Input() onRequestHandler: (value: string) => any = (val: string) => void 0;
    @Input() onAcceptHandler: (value: string) => any = (val: string) => void 0;
    @Input() onResetHandler: () => any = () => void 0;

    private value: string = '';
    private placeholder: string = 'Type regular expression';
    private lastReqExp: string = '';
    private handles: {
        onFocus: (...args: any[]) => any,
        onBlur: (...args: any[]) => any,
        onKeyDown: (...args: any[]) => any,
        onKeyUp: (...args: any[]) => any,
        onChange: (...args: any[]) => any,
    };


    constructor(private changeDetectorRef : ChangeDetectorRef) {
        this.handles        = {
            onFocus     : this.onFocus.     bind(this),
            onBlur      : this.onBlur.      bind(this),
            onKeyDown   : this.onKeyDown.   bind(this),
            onKeyUp     : this.onKeyUp.     bind(this),
            onChange    : this.onChange.    bind(this),
        };
    }


    ngAfterContentInit(){
        this.input.setFocus();
        this.input.onUp.subscribe(this.onUpArrow.bind(this));
        this.input.onDown.subscribe(this.onDownArrow.bind(this));
        this.input.onLeft.subscribe(this.onLeftArrow.bind(this));
        this.input.onRight.subscribe(this.onRightArrow.bind(this));
    }

    forceUpdate(){
        this.changeDetectorRef.detectChanges();
    }

    onFocus(event: Event){
    }

    onBlur(event: Event){
    }

    onUpArrow(){
        
    }

    onDownArrow(){
        
    }

    onLeftArrow(){
        
    }

    onRightArrow(){
        
    }

    onKeyDown(event: Event, value: string){
    }

    onKeyUp(event: KeyboardEvent){
        if (event.shiftKey && (event.code === 'ArrowUp' || event.code === 'ArrowDown')) {
            return;
        }
        if (event.code === 'Enter') {
            this.value = (event.target as HTMLInputElement).value;
            this.onRequestHandler(this.value);
        }
    }

    onChange(event: Event){
    }

    setInputFocus(){
        if (this.input === null || this.input === void 0) {
            return;
        }
        this.input.setFocus();
    }

    resetInput(){
        this.value = '';
        this.input.setValue('');
    }

    private _onAddRequest() {
        this.onAcceptHandler(this.value);
        this.resetInput();
    }

    private _onDropRequest() {
        this.resetInput();
        this.onResetHandler();
    }

}
