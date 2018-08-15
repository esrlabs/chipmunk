import {Component, Input, ChangeDetectorRef, ViewChild, ViewContainerRef, AfterViewChecked } from '@angular/core';
import {DomSanitizer                                } from '@angular/platform-browser';
import { serviceRequests                            } from '../../../../services/service.requests';
import { Request, Preset                            } from '../../../../services/interface.request';
import { CommonInput                                } from "../../input/component";
import { DialogMessage                              } from "../dialog-message/component";
import { DialogMessageList                          } from "../dialog-message-list/component";
import { popupController                            } from "../../popup/controller";
import { fileLoaderController                       } from "../../fileloader/controller";
import { ProgressBarCircle                          } from "../../progressbar.circle/component";
import { DIRECTIONS, Method, Request as AJAXRequest } from "../../../../modules/tools.ajax";
import { DialogA                                    } from "../dialog-a/component";
import { EContextMenuItemTypes, IContextMenuItem, IContextMenuEvent } from '../../../context-menu/interfaces';
import {events as Events} from "../../../../modules/controller.events";
import {configuration as Configuration} from "../../../../modules/controller.config";

@Component({
    selector    : 'search-requests-presets',
    templateUrl : './template.html',
})

export class DialogSearchRequestsPresets implements AfterViewChecked {
    @Input() close: Function = null;

    @ViewChild ('exporturl', { read: ViewContainerRef}) exportURLNode: ViewContainerRef;

    private requests: Array<Request> = [];
    private presets: Array<Preset> = [];
    private current: Array<Request> = [];
    private selected: number = 0;
    private waitPopupGUID: symbol = Symbol();
    private changes: boolean = false;
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
        this.requests = this.serializeRequests(serviceRequests.getRequests());
        this.current = this.serializeRequests(serviceRequests.getRequests());
        this.presets = this.safelySetArrayValue(serviceRequests.getPresets());
        this.addCurrentPreset();
        this.onRemove = this.onRemove.bind(this);
        this.onSelect = this.onSelect.bind(this);
        this.onExport = this.onExport.bind(this);
        this.onImportFromFile = this.onImportFromFile.bind(this);
        this.onImportByURL = this.onImportByURL.bind(this);
        this.onCloseEditor = this.onCloseEditor.bind(this);
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
        return value instanceof Array ? value.slice() : [];
    }

    serializeRequests(requests: Array<Request>){
        return requests instanceof Array ? requests.map((request: Request) => {
            return Object.assign({}, request)
        }) : [];
    }

    resetListsSelection(){
        this.selected = 0;
        this.requests = this.serializeRequests(this.current);
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    * Presets & requests manager
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    getClearedPresets(){
        return this.presets.filter((preset, index) => { return index !== 0; });
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
            requests: this.serializeRequests(this.current)
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
        this.requests = this.serializeRequests(this.presets[index].requests);
    }

    onRemove(event: MouseEvent, index: number){
        if (index === 0) {
            return false;
        }
        this.presets.splice(index, 1);
        this.changes = true;
        this.resetListsSelection();
    }

    onRemoveRequest(event: MouseEvent, index: number){
        if (this.selected === -1) {
            return;
        }
        if (this.presets[this.selected] === void 0) {
            return;
        }
        this.presets[this.selected].requests.splice(index, 1);
        if (this.presets[this.selected].requests.length === 0) {
            this.presets.splice(this.selected, 1);
            this.resetListsSelection();
        } else {
            this.requests = this.serializeRequests(this.presets[this.selected].requests);
        }
        this.changes = true;
    }

    onRename(event: MouseEvent, index: number){
        if (index === 0 || this.presets[index] === void 0) {
            return false;
        }
        let guid = Symbol();
        popupController.open({
            content : {
                factory     : null,
                component   : DialogA,
                params      : {
                    caption: `Define new name of preset: "${this.presets[index].name}".`,
                    value  : this.presets[index].name,
                    buttons: [
                        {
                            caption: 'Rename',
                            handle : (name: string) => {
                                popupController.close(guid);
                                if (name.trim() === ''){
                                }
                                this.presets[index].name = name;
                                this.changes = true;
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
            title   : 'Rename of preset',
            settings: {
                move            : true,
                resize          : false,
                width           : '30rem',
                height          : '12rem',
                close           : true,
                addCloseHandle  : true,
                css             : ''
            },
            buttons         : [],
            titlebuttons    : [],
            GUID            : guid
        });
    }

    onSelectPreset(event: MouseEvent, index: number){
        this.getCloseConfirmation(() => {
            if (index > 0 && this.presets[index] !== void 0) {
                serviceRequests.updateRequests(this.presets[index].requests);
            }
            typeof this.close === 'function' && this.close();
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
                    this.changes = true;
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
    }

    onCloseEditor(){
        this.getCloseConfirmation(() => {
            typeof this.close === 'function' && this.close();
        });
    }

    getCloseConfirmation(callback: Function){
        if (this.changes) {
            let guid = Symbol();
            popupController.open({
                content : {
                    factory     : null,
                    component   : DialogMessage,
                    params      : {
                        message: `Collection of preset was changed. Do you want to save changes?`,
                        buttons: [
                            {
                                caption: 'Yes, save',
                                handle : () => {
                                    this.savePresets();
                                    popupController.close(guid);
                                    callback();
                                }
                            },
                            {
                                caption: 'No, keep it',
                                handle : ()=>{
                                    popupController.close(guid);
                                    callback();
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
                    height          : '12rem',
                    close           : true,
                    addCloseHandle  : true,
                    css             : ''
                },
                buttons         : [],
                titlebuttons    : [],
                GUID            : guid
            });
        } else {
            callback();
        }
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    * Context menu
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    isPresetNameExist(name: string): boolean {
        let result = false;
        this.presets.forEach((preset: Preset) => {
            if (preset.name === name) {
                result = true;
            }
        });
        return result;
    }

    getNewPresetName(basename: string){
        if (!this.isPresetExist(basename)) {
            return basename;
        }
        let index = 0;
        do {
            index += 1;
        } while (this.isPresetExist(`${basename} ${index}`));
        return `${basename} ${index}`;
    }

    onContextMenuPreset(event: MouseEvent, index: number){
        if (index < 0 || this.presets[index] === void 0) {
            return false;
        }
        let contextEvent = {x: event.pageX,
            y: event.pageY,
            items: [
                {
                    caption : index > 0 ? 'Duplicate' : 'Create new preset',
                    type    : EContextMenuItemTypes.item,
                    handler : () => {
                        let name;
                        if (index === 0) {
                            name = this.getNewPresetName('New preset');
                        } else {
                            name = this.getNewPresetName(this.presets[index].name);
                        }
                        this.presets.push({
                            name: name,
                            requests: this.presets[index].requests.slice()
                        });
                        this.changes = true;
                    }
                }
            ]} as IContextMenuEvent;
        if (index !== 0) {
            contextEvent.items.push(...[
                { type: EContextMenuItemTypes.divider },
                {
                    caption : 'Change name',
                    type    : EContextMenuItemTypes.item,
                    handler : () => {
                        this.onRename(null, index);
                    }
                },
                {
                    caption : 'Delete preset',
                    type    : EContextMenuItemTypes.item,
                    handler : () => {
                        this.onRemove(null, index);
                    }
                }
            ]);
        }
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.CONTEXT_MENU_CALL, contextEvent);
        event.preventDefault();
        event.stopPropagation();
        return false;
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    * Other
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    importByURL(url: string){
        this.showWaitPopup();
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
                this.changes = true;
            }
        }).catch((error : Error)=>{
            popupController.close(this.waitPopupGUID);
        });
        request.send();
    }
}
