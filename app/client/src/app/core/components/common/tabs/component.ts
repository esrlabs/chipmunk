import {Component, Input, AfterViewChecked, EventEmitter, OnDestroy } from '@angular/core';
import { configuration as Configuration } from '../../../modules/controller.config';
import { events as Events               } from '../../../modules/controller.events';
import { Tab                            } from './interface.tab';

@Component({
    selector    : 'common-tabs',
    templateUrl : './template.html',
})
export class CommonTabs implements AfterViewChecked, OnDestroy {
    @Input() tabs       : Array<Tab>            = [];
    @Input() onResize   : EventEmitter<null>    = new EventEmitter();

    private switched    : boolean       = false;
    private attached    : boolean       = false;

    constructor() {
    }

    ngAfterViewChecked(){
        if (this.switched){
            this.switched = false;
            this.tabs.forEach((_tab: Tab) => {
                _tab.active     && (_tab.onSelect   !== void 0 && _tab.onSelect.    emit());
                !_tab.active    && (_tab.onDeselect !== void 0 && _tab.onDeselect.  emit());
            });
        }
        if (this.onResize !== null && !this.attached){
            this.attached       = true;
            this.onResizeHandle = this.onResizeHandle.bind(this);
            this.onResize.subscribe(this.onResizeHandle);
        }
    }

    ngOnDestroy(){
        this.onResize !== null && this.onResize.unsubscribe();
    }

    onResizeHandle(){
        this.tabs.forEach((_tab: Tab) => {
            _tab.active && (_tab.onSelect !== void 0 && _tab.onResize.emit());
        });
    }

    onSwitch(tab: Tab){
        this.tabs.forEach((_tab: Tab) => {
            _tab.active = (tab.id === _tab.id);
        });
        this.switched = true;
    }
}
