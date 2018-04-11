import { Component, Input, AfterContentInit, OnInit, EventEmitter, ComponentFactoryResolver } from '@angular/core';

import { Tab                            } from '../../tabs/interface.tab';
import { DialogVisualSettingTab         } from './visual/component';
import { DialogOutputSettingTab         } from './output/component';
import { DialogAPISettings              } from '../api.settings/component';
import {IServerSetting, settings} from '../../../../modules/controller.settings';
import {configuration as Configuration} from "../../../../modules/controller.config";
import {events as Events} from "../../../../modules/controller.events";

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
        let emitterVisualSelect    = new EventEmitter<any>(),
            emitterVisualDeselect  = new EventEmitter<any>(),
            emitterVisualResize    = new EventEmitter<any>();
        let emitterOutputSelect    = new EventEmitter<any>(),
            emitterOutputDeselect  = new EventEmitter<any>(),
            emitterOutputResize    = new EventEmitter<any>();
        let emitterServerSelect    = new EventEmitter<any>(),
            emitterServerDeselect  = new EventEmitter<any>(),
            emitterServerResize    = new EventEmitter<any>();
        this.tabs.push({
            id          : Symbol(),
            label       : 'Settings',
            onSelect    : emitterVisualSelect,
            onDeselect  : emitterVisualDeselect,
            onResize    : emitterVisualResize,
            factory     : this.componentFactoryResolver.resolveComponentFactory(DialogVisualSettingTab),
            params      : {
                visual      : this.getSettings('visual'),
                active      : true,
                register    : this.onRegister.bind(this),
                onSelect    : emitterVisualSelect,
                onDeselect  : emitterVisualDeselect,
                onResize    : emitterVisualResize,
            },
            update      : null,
            active      : true
        });
        this.tabs.push({
            id          : Symbol(),
            label       : 'Output',
            onSelect    : emitterOutputSelect,
            onDeselect  : emitterOutputDeselect,
            onResize    : emitterOutputResize,
            factory     : this.componentFactoryResolver.resolveComponentFactory(DialogOutputSettingTab),
            params      : {
                output      : this.getSettings('output'),
                active      : false,
                register    : this.onRegister.bind(this),
                onSelect    : emitterOutputSelect,
                onDeselect  : emitterOutputDeselect,
                onResize    : emitterOutputResize,
            },
            update      : null,
            active      : false
        });
        this.tabs.push({
            id          : Symbol(),
            label       : 'API & Service',
            onSelect    : emitterServerSelect,
            onDeselect  : emitterServerDeselect,
            onResize    : emitterServerResize,
            factory     : this.componentFactoryResolver.resolveComponentFactory(DialogAPISettings),
            params      : {
                server      : this.getSettings('server'),
                active      : false,
                register    : this.onRegister.bind(this),
                onSelect    : emitterServerSelect,
                onDeselect  : emitterServerDeselect,
                onResize    : emitterServerResize,
                proceed     : function (serverSettings : IServerSetting) {
                    Events.trigger(Configuration.sets.SYSTEM_EVENTS.WS_SETTINGS_CHANGED, serverSettings);
                }.bind(this),
            },
            update      : null,
            active      : false
        });
    }

    onRegister(register: Register){
        this.section = register.section;
        this.getData = register.getData;
    }


    getSettings(section: string){
        const _settings = settings.get();
        return typeof _settings[section] === 'object' ? (_settings[section] !== null ? _settings[section] : {}) : {};
    }

    save(){
        const _settings = settings.get();
        if (_settings[this.section] !== void 0) {
            _settings[this.section] = this.getData();
            settings.set(_settings);
            switch (this.section){
                case 'visual':
                    Events.trigger(Configuration.sets.SYSTEM_EVENTS.VISUAL_SETTINGS_IS_UPDATED);
                    break;
            }
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
