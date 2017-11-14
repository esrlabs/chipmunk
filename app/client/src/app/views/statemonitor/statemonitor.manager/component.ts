import {Component, OnInit, ComponentFactoryResolver, ViewContainerRef, ChangeDetectorRef, EventEmitter, OnDestroy, ViewChild,  AfterViewChecked} from '@angular/core';
import {DomSanitizer                            } from '@angular/platform-browser';

import { events as Events                       } from '../../../core/modules/controller.events';
import { configuration as Configuration         } from '../../../core/modules/controller.config';

import { ViewInterface                          } from '../../../core/interfaces/interface.view';

import { Indicate, IndicateState                } from '../statemonitor.monitor/item/interface';

import { localSettings, KEYs                    } from '../../../core/modules/controller.localsettings';

import { popupController                        } from '../../../core/components/common/popup/controller';
import { DialogStatemonitorIndicateEdit         } from '../../../core/components/common/dialogs/statemonitor.indicate.edit/component';
import { DialogStatemonitorEditJSON             } from '../../../core/components/common/dialogs/statemonitor.edit/component';
import { TabController                          } from '../../../core/components/common/tabs/tab/class.tab.controller';

import { fileLoaderController                   } from '../../../core/components/common/fileloader/controller';
import { ProgressBarCircle                      } from '../../../core/components/common/progressbar.circle/component';
import { DialogMessage                          } from '../../../core/components/common/dialogs/dialog-message/component';

const SETTINGS = {
    LIST_KEY    : 'LIST_KEY'
};


@Component({
    selector        : 'view-controller-state-monitor-manager',
    templateUrl     : './template.html'
})

export class ViewControllerStateMonitorManager extends TabController implements ViewInterface, OnInit, OnDestroy, AfterViewChecked {
    @ViewChild ('exporturl', { read: ViewContainerRef}) exportURLNode: ViewContainerRef;

    public indicates    : Array<Indicate>   = [];

    public exportdata       : {
        url         : any,
        filename    : string
    } = {
        url         : null,
        filename    : ''
    };

    ngOnInit(){
    }

    ngOnDestroy(){
        [   ].forEach((handle: string)=>{
            Events.unbind(handle, this['on' + handle]);
        });
    }

    ngAfterViewChecked(){
        if (this.exportdata.url !== null && this.exportURLNode !== null){
            this.exportURLNode.element.nativeElement.click();
            this.exportdata.url         = null;
            this.exportdata.filename    = '';
        }
    }

    forceUpdate(){
        this.changeDetectorRef.detectChanges();
    }

    constructor(
        private componentFactoryResolver    : ComponentFactoryResolver,
        private viewContainerRef            : ViewContainerRef,
        private changeDetectorRef           : ChangeDetectorRef,
        private sanitizer                   : DomSanitizer
    ){
        super();
        this.componentFactoryResolver   = componentFactoryResolver;
        this.viewContainerRef           = viewContainerRef;
        this.changeDetectorRef          = changeDetectorRef;

        [   ].forEach((handle: string)=>{
            this['on' + handle] = this['on' + handle].bind(this);
            Events.bind(handle, this['on' + handle]);
        });
        this.addIndicate    = this.addIndicate.bind(this);
        this.onEditAsJSON   = this.onEditAsJSON.bind(this);
        this.onExport       = this.onExport.bind(this);
        this.onImport       = this.onImport.bind(this);
        this.onRemoveAll    = this.onRemoveAll.bind(this);
        this.loadIndicates();
    }

    loadIndicates(){
        let settings = localSettings.get();
        if (settings !== null
            && settings[KEYs.view_statemonitor] !== void 0
            && settings[KEYs.view_statemonitor] !== null
            && typeof settings[KEYs.view_statemonitor][SETTINGS.LIST_KEY] === 'object'
            && settings[KEYs.view_statemonitor][SETTINGS.LIST_KEY] !== null){
            this.indicates = Object.keys(settings[KEYs.view_statemonitor][SETTINGS.LIST_KEY]).map((id)=>{
                return Object.assign({}, settings[KEYs.view_statemonitor][SETTINGS.LIST_KEY][id]);
            });
        } else {
            this.indicates = Object.keys(Configuration.sets.VIEW_STATEMONITOR.IndicatesRules).map((id)=>{
                return Object.assign({}, Configuration.sets.VIEW_STATEMONITOR.IndicatesRules[id]);
            });
        }
    }

    saveIndicates(){
        localSettings.set({
            [KEYs.view_statemonitor] : {
                [SETTINGS.LIST_KEY] : this.indicates
            }
        });
    }

    addIndicate(){
        let popup = Symbol();
        popupController.open({
            content : {
                factory     : null,
                component   : DialogStatemonitorIndicateEdit,
                params      : {
                    name                : '',
                    callback            : function(name: string){
                        if (typeof name === 'string' && name.trim() !== ''){
                            this.indicates.push({
                                name        : name,
                                icon        : '',
                                css         : '',
                                label       : name,
                                description : '',
                                states      : []
                            });
                            this.forceUpdate();
                            popupController.close(popup);
                        }
                    }.bind(this)
                }
            },
            title   : _('Add New Indicate'),
            settings: {
                move            : true,
                resize          : false,
                width           : '40rem',
                height          : '7.5rem',
                close           : true,
                addCloseHandle  : true,
                css             : ''
            },
            buttons         : [ ],
            titlebuttons    : [],
            GUID            : popup
        });
    }

    onIndicateRemove(index: number){
        this.indicates[index] !== void 0 && this.indicates.splice(index, 1);
        this.saveIndicates();
    }

    onIndicateUpdate(index: number, indicate: Indicate){
        if (this.indicates[index] !== void 0){
            this.indicates[index] = indicate;
            this.saveIndicates();
        }
    }

    onEditAsJSON(){
        let popup = Symbol();
        popupController.open({
            content : {
                factory     : null,
                component   : DialogStatemonitorEditJSON,
                params      : {
                    json        : JSON.stringify(this.indicates),
                    callback    : function(json: string){
                        this.indicates = JSON.parse(json);
                        this.saveIndicates();
                        popupController.close(popup);
                    }.bind(this)
                }
            },
            title   : _('Edit monitor rules'),
            settings: {
                move            : true,
                resize          : true,
                width           : '40rem',
                height          : '35rem',
                close           : true,
                addCloseHandle  : true,
                css             : ''
            },
            buttons         : [],
            titlebuttons    : [],
            GUID            : popup
        });

    }

    showErrorMessage(title: string, message: string){
        let popup   = Symbol();
        popupController.open({
            content : {
                factory     : null,
                component   : DialogMessage,
                params      : {
                    message : message,
                    buttons : [
                        { caption: 'OK',    handle: ()=>{ popupController.close(popup); }},
                    ]
                }
            },
            title   : title,
            settings: {
                move            : true,
                resize          : true,
                width           : '30rem',
                height          : '15rem',
                close           : true,
                addCloseHandle  : true,
                css             : ''
            },
            buttons         : [],
            titlebuttons    : [],
            GUID            : popup
        });
    }

    onRemoveAll(){
        let GUID = Symbol();
        this.indicates.length > 0 && popupController.open({
            content : {
                factory     : null,
                component   : DialogMessage,
                params      : {
                    message : 'Are you sure that you want to remove indicates? Export it before to have a possibility to restore it after.',
                    buttons : [
                        { caption: 'Export it and remove',    handle: ()=>{ this.onExport(); this.removeAll(); popupController.close(GUID); }},
                        { caption: 'Just remove it',    handle: ()=>{ this.removeAll(); popupController.close(GUID); }},
                        { caption: 'Leave it',      handle: ()=>{ popupController.close(GUID); }},

                    ]
                }
            },
            title   : _('Confirmation'),
            settings: {
                move            : true,
                resize          : true,
                width           : '30rem',
                height          : '10rem',
                close           : true,
                addCloseHandle  : true,
                css             : ''
            },
            buttons         : [],
            titlebuttons    : [],
            GUID            : GUID
        });
    }

    removeAll(){
        this.indicates = [];
        this.saveIndicates();
    }

    validateImportData(smth: any) {
        let result      = {
                result  : true,
                msg     : ''
            },
            _indicate   = {
                name: 'string'
            },
            _state      = {
                icon    : 'string',
                hook    : 'string',
                label   : 'string',
                defaults: 'boolean'
            };
        if (smth instanceof Array){
            smth.forEach((indicate: Indicate)=>{
                if (result.result && indicate !== null && typeof indicate === 'object'){
                    Object.keys(_indicate).forEach((key)=>{
                        if ((typeof indicate[key] !== _indicate[key])) {
                            result.msg      = `indicate's property [${key}] should have format [${_indicate[key]}]`;
                            result.result   = false;
                        }
                    });
                    if (result && indicate.states instanceof Array){
                        indicate.states.forEach((state: IndicateState)=>{
                            if (result && state !== null && typeof state === 'object'){
                                Object.keys(_state).forEach((key)=>{
                                    if ((typeof state[key] !== _state[key])){
                                        result.msg      = `state's property [${key}] should have format [${_state[key]}]`;
                                        result.result   = false;
                                    }
                                });
                            } else {
                                result.msg === '' && (result.msg = `states should have format [Array]`);
                                result.result = false;
                            }
                        });
                    } else {
                        result.msg === '' && (result.msg = `indicate's property [states] should have format [Array]`);
                        result.result = false;
                    }
                } else {
                    result.msg === '' && (result.msg = `indicate should be [Object]`);
                    result.result = false;
                }
            });
        } else {
            result.msg === '' && (result.msg = `collection of indicates should be [Array]`);
            result.result = false;
        }
        return result;
    }

    onImport(){
        let GUID = Symbol();
        fileLoaderController.open(Symbol(), {
            load    : (data : string, files: Array<File>)=>{
                popupController.close(GUID);
                if (typeof data === 'string') {
                    try{
                        let result = JSON.parse(data);
                        if (this.validateImportData(result).result){
                            this.indicates = result;
                            this.saveIndicates();
                        } else {
                            this.showErrorMessage('Wrong format', 'Basically JSON format is okay. But we\'ve tried to parse content and didn\'t find data, which can be used for indicates. Or imported data has some incorrect /corrupted format. More info: ' + this.validateImportData(result).msg);
                        }
                    }catch (e){
                        this.showErrorMessage('Wrong JSON format', 'Cannot parse content of file. Expected format is JSON.');
                    }
                }
            },
            error   :(event : Event)=>{

            },
            reading :(file : File)=>{
                popupController.open({
                    content : {
                        factory     : null,
                        component   : ProgressBarCircle,
                        params      : {}
                    },
                    title   : 'Please, wait...',
                    settings: {
                        move            : false,
                        resize          : false,
                        width           : '20rem',
                        height          : '10rem',
                        close           : false,
                        addCloseHandle  : false,
                        css             : ''
                    },
                    buttons         : [],
                    titlebuttons    : [],
                    GUID            : GUID
                });
            }
        });
    }

    onExport(){
        if (Object.keys(this.indicates).length > 0){
            let str     = JSON.stringify(this.indicates),
                blob    = new Blob([str], {type: 'text/plain'}),
                url     = URL.createObjectURL(blob);
            this.exportdata.url         = this.sanitizer.bypassSecurityTrustUrl(url);
            this.exportdata.filename    = 'export_chats_sets' + (new Date()).getTime() + '.json';
        }
    }

}
