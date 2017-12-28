import { Component, Input} from '@angular/core';

@Component({
    selector    : 'drop-down-menu',
    templateUrl : './template.html',
})
export class DropDownMenu {
    @Input() className  : string        = '';
    @Input() icon       : string        = '';
    @Input() caption    : string        = '';
    @Input() items      : Array<Object> = [];

    private isOpen          : boolean = false;
    private triggerClick    : boolean = false;

    constructor(){
        window.addEventListener('click', this.onClickWindow.bind(this));
    }

    isTriggerClick() {
        let triggerClick = this.triggerClick;
        this.triggerClick = false;
        return triggerClick;
    }
    onMenuClick(){
        this.isOpen         = !this.isOpen;
        this.triggerClick   = true;
    }

    onItemClick(handler: Function){
        this.isOpen = false;
        typeof handler === 'function' && handler();
    }

    onClickWindow(){
        !this.isTriggerClick() && (this.isOpen = false);
    }
}
