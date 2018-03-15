import {Component, Input, ChangeDetectorRef, ViewChild, ViewContainerRef, AfterViewChecked } from '@angular/core';
import {DomSanitizer                                } from '@angular/platform-browser';
import { serviceRequests                            } from '../../../../services/service.requests';
import { Request, Preset                            } from '../../../../services/interface.request';
import { CommonInput                                } from "../../input/component";
import { DialogMessage                              } from "../dialog-message/component";
import { DialogMessageList                          } from "../dialog-message-list/component";
import { popupController                            } from "../../popup/controller";
import { fileLoaderController                       } from '../../../../components/common/fileloader/controller';
import { ProgressBarCircle                          } from "../../progressbar.circle/component";
import { DIRECTIONS, Method, Request as AJAXRequest } from "../../../../modules/tools.ajax";
import { DialogA                                    } from "../dialog-a/component";

@Component({
    selector    : 'search-requests-presets',
    templateUrl : './template.html',
})

export class DialogSearchRequestsPresets implements AfterViewChecked {
    @Input() close: Function = null;

    @ViewChild('nameInput' ) nameInput : CommonInput;
    @ViewChild ('exporturl', { read: ViewContainerRef}) exportURLNode: ViewContainerRef;

    private requests: Array<Request> = [];
    private presets: Array<Preset> = [];
    private current: Array<Request> = [];
    private selected: number = -1;
    private waitPopupGUID: symbol = Symbol();
    public exportdata       : {
        url         : any,
        filename    : string
    } = {
        url         : null,
        filename    : ''
    };

    constructor(private changeDetectorRef   : ChangeDetectorRef,
                private sanitizer           : DomSanitizer) {
        this.changeDetectorRef = changeDetectorRef;
        this.requests = this.safelySetArrayValue(serviceRequests.getRequests());
        this.current = this.safelySetArrayValue(serviceRequests.getRequests());
        this.presets = this.safelySetArrayValue(serviceRequests.getPresets());
        this.addCurrentPreset();
        this.onRemove = this.onRemove.bind(this);
        this.onSelect = this.onSelect.bind(this);
        this.onNew = this.onNew.bind(this);
        this.onSaveAs = this.onSaveAs.bind(this);
        this.onExport = this.onExport.bind(this);
        this.onImportFromFile = this.onImportFromFile.bind(this);
        this.onImportByURL = this.onImportByURL.bind(this);
        this.onApply = this.onApply.bind(this);
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

    isPresetExist(name: string){
        let result = false;
        this.presets.forEach((preset: Preset) => {
            preset.name === name && (result = true);
        });
        return result;
    }

    safelySetArrayValue(value: any){
        return value instanceof Array ? value : [];
    }

    resetListsSelection(){
        this.selected = -1;
        this.requests = this.current;
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    * Presets & requests manager
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    getClearedPresets(){
        return this.presets.filter((preset, index) => { return index !== 0; });
    }

    overwritePreset(index: number, callback?: Function){
        this.presets[index].requests = this.requests;
        this.savePresets();
        typeof callback === 'function' && callback();
    }

    savePresets(){
        serviceRequests.setPresets(this.getClearedPresets());
    }

    validatePresets(str: string){
        let result = null;
        try {
            result = JSON.parse(str);
        } catch (e){
            result = null;
        }

        if (result instanceof Array){
            let valid = true;
            result.forEach((preset: Preset) => {
                if (!valid){
                    return false;
                }
                if (typeof preset !== 'object' || preset === null ) {
                    valid = false;
                } else if (typeof preset.name !== 'string' || preset.name.trim() === ''){
                    valid = false;
                } else if (!(preset.requests instanceof Array)){
                    valid = false;
                } else {
                    preset.requests.forEach((request: Request) => {
                        if (!valid){
                            return false;
                        }
                        if (typeof request !== 'object' || request === null){
                            valid = false;
                        } else {
                            const props = {
                                GUID: 'string',
                                value: 'string',
                                type: 'string',
                                foregroundColor: 'string',
                                backgroundColor: 'string',
                                active: 'boolean',
                                visibility: 'boolean',
                                passive: 'boolean',
                                count: 'number',
                            };
                            Object.keys(props).forEach((prop: string) => {
                                if (!valid){
                                    return false;
                                }
                                if (typeof request[prop] !== props[prop]) {
                                    valid = false;
                                }
                            });
                        }
                    });
                }
            });
            if (!valid){
                result = null;
            }
        } else {
            result = null;
        }
        return result;
    }

    addCurrentPreset(){
        this.presets.unshift({
            name: _('Current Requests'),
            requests: this.current
        });
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    * Dialogs
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    showWaitPopup(){
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
            GUID            : this.waitPopupGUID
        });
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    * Buttons handlers
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

    onSelect(event: MouseEvent, index: number){
        this.selected = index;
        this.requests = this.presets[index].requests;
    }

    onRemove(event: MouseEvent, index: number){
        if (index === 0) {
            return false;
        }
        let guid = Symbol();
        popupController.open({
            content : {
                factory     : null,
                component   : DialogMessage,
                params      : {
                    message: `Please, confirm removing "${this.presets[index].name}" preset. If you are not sure, you can export your presets to file before.`,
                    buttons: [
                        {
                            caption: 'Yes, remove',
                            handle : () => {
                                this.presets.splice(index, 1);
                                this.savePresets();
                                this.resetListsSelection();
                                popupController.close(guid);
                            }
                        },
                        {
                            caption: 'No, keep it',
                            handle : ()=>{
                                popupController.close(guid);
                            }
                        }
                    ]
                }
            },
            title   : 'Confirmation',
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
            GUID            : guid
        });
    }

    onNew(){
        const name = this.nameInput.getValue().trim();
        if (name === '') {
            return this.nameInput.setValue('');
        }
        if (this.isPresetExist(name)){
            return this.nameInput.setValue('');
        }
        if (this.requests.length === 0) {
            return false;
        }
        this.presets.push({
            name: name,
            requests: this.requests
        });
        this.savePresets();
    }

    onSaveAs(){
        let guid = Symbol();
        popupController.open({
            content : {
                factory     : null,
                component   : DialogMessageList,
                params      : {
                    message: `Select preset, which should be overwritten, but current requests`,
                    list   : this.presets.map((preset: Preset, index: number) => {
                        if (index === 0) {
                            return null;
                        }
                        return {
                            caption: preset.name,
                            handle: this.overwritePreset.bind(this, index, () => {
                                popupController.close(guid);
                            })
                        }
                    }).filter((item) => { return item !== null; } ),
                    buttons: [
                        {
                            caption: 'Cancel',
                            handle : ()=>{
                                popupController.close(guid);
                            }
                        }
                    ]
                }
            },
            title   : 'Confirmation',
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
            GUID            : guid
        });
    }

    onExport(){
        if (this.getClearedPresets().length === 0) {
            return false;
        }
        let str     = JSON.stringify(this.getClearedPresets()),
            blob    = new Blob([str], {type: 'text/plain'}),
            url     = URL.createObjectURL(blob);
        this.exportdata.url         = this.sanitizer.bypassSecurityTrustUrl(url);
        this.exportdata.filename    = 'filters_presets_' + (new Date()).getTime() + '.json';
        this.forceUpdate();
    }

    onImportFromFile(){
        let started = false;
        fileLoaderController.open(Symbol(), {
            load    : (data : string, files: Array<File>)=>{
                popupController.close(this.waitPopupGUID);
                let presets = this.validatePresets(data);
                if (presets !== null){
                    this.presets = presets;
                    this.addCurrentPreset();
                    this.savePresets();
                }
            },
            error   :(event : Event)=>{

            },
            reading :(file : File)=>{
                if (!started){
                    this.showWaitPopup();
                    started = true;
                }
            }
        });
    }

    onImportByURL(){
        const guid = Symbol();
        popupController.open({
            content : {
                factory     : null,
                component   : DialogA,
                params      : {
                    caption: 'Type URL of source of data',
                    value: '',
                    type: 'test',
                    placeholder: 'Type source URL',
                    buttons: [
                        {
                            caption: 'Import',
                            handle : (url: string)=>{
                                popupController.close(guid);
                                url.trim() !== '' && this.importByURL(url);
                            }
                        },
                        {
                            caption: 'Cancel',
                            handle : ()=>{
                                popupController.close(guid);
                            }
                        }
                    ]
                }
            },
            title   : 'Get presets by URL',
            settings: {
                move            : true,
                resize          : true,
                width           : '40rem',
                height          : '12rem',
                close           : true,
                addCloseHandle  : false,
                css             : ''
            },
            buttons         : [],
            titlebuttons    : [],
            GUID            : guid
        });
        /*

        */
    }

    onApply(){
        serviceRequests.updateRequests(this.requests);
        typeof this.close === 'function' && this.close();
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    * Other
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    importByURL(url: string){
        this.showWaitPopup();
        //const url = 'https://raw.githubusercontent.com/esrlabs/esrlabs.com/master/package.json?token=AMP64157xMWj0wNzGCy5aEji0rH15Tc0ks5as42LwA%3D%3D';
        let request = new AJAXRequest({
            url         : url,
            method      : new Method(DIRECTIONS.GET)
        }).then((response : any)=>{
            popupController.close(this.waitPopupGUID);
            if (typeof response === 'object' && response !== null) {
                response = JSON.stringify(response);
            } else if (typeof response !== 'string'){
                return false;
            }
            let presets = this.validatePresets(response);
            if (presets !== null){
                this.presets = presets;
                this.addCurrentPreset();
                this.savePresets();
            }
        }).catch((error : Error)=>{
            popupController.close(this.waitPopupGUID);
        });
        request.send();
    }
}
