import { Component, Input, AfterContentInit, OnInit, EventEmitter, ComponentFactoryResolver } from '@angular/core';

import { Tab                            } from '../../tabs/interface.tab';
import { DialogVisualSettingTab         } from './visual/component';
import { settings, Visual               } from '../../../../modules/controller.settings';
import set = Reflect.set;

interface Register {
    getData: Function,
    section: string
}

@Component({
    selector    : 'dialog-settings-manager',
    templateUrl : './template.html',
})

export class DialogSettingsManager implements OnInit{

    @Input() close   : Function = null;

    private section     : string                = '';
    private tabs        : Array<Tab>            = [];
    private onResize    : EventEmitter<null>    = new EventEmitter();
    private getData     : Function              = null;

    constructor(private componentFactoryResolver : ComponentFactoryResolver) {
        this.onApply        = this.onApply.bind(this);
        this.onSaveAndClose = this.onSaveAndClose.bind(this);
        this.onClose        = this.onClose.bind(this);
    }

    ngOnInit(){
        this.initTabs();
    }

    initTabs(){
        let emitterResultsSelect    = new EventEmitter<any>(),
            emitterResultsDeselect  = new EventEmitter<any>(),
            emitterResultsResize    = new EventEmitter<any>();
        this.tabs.push({
            id          : Symbol(),
            label       : 'Settings',
            onSelect    : emitterResultsSelect,
            onDeselect  : emitterResultsDeselect,
            onResize    : emitterResultsResize,
            factory     : this.componentFactoryResolver.resolveComponentFactory(DialogVisualSettingTab),
            params      : {
                visual      : this.getSettings('visual'),
                register    : this.onRegister.bind(this),
                onSelect    : emitterResultsSelect,
                onDeselect  : emitterResultsDeselect,
                onResize    : emitterResultsResize
            },
            update      : null,
            active      : true
        });
    }

    onRegister(register: Register){
        this.section = register.section;
        this.getData = register.getData;
    }


    getSettings(section: string){
        const _settings = settings.get();
        return _settings[section];
    }

    save(){
        const _settings = settings.get();
        if (_settings[this.section] !== void 0) {
            _settings[this.section] = this.getData();
            settings.set(_settings);
        }
    }

    onApply(){
        this.save();
    }

    onSaveAndClose(){
        this.save();
        this.close();
    }

    onClose(){
        this.close();
    }
}
