import {
    Component, Input, Output, ViewChild, AfterContentInit, OnInit, ViewContainerRef,
    ComponentFactoryResolver, ChangeDetectorRef, OnDestroy, AfterViewChecked
} from '@angular/core';
import {DomSanitizer } from '@angular/platform-browser';
import { KEYs, localSettings} from '../../../../../modules/controller.localsettings';
import {TabController} from "../../../tabs/tab/class.tab.controller";
import {DialogMessage} from "../../dialog-message/component";
import {popupController} from "../../../popup/controller";
import {fileLoaderController} from "../../../fileloader/controller";
import {ProgressBarCircle} from "../../../progressbar.circle/component";
import {DialogSettingsManagerImportConfirmation} from "./import.dialog/component";
import set = Reflect.set;

const IMPORTING = [
    KEYs.view_serialsender,
    KEYs.view_markers,
    KEYs.view_statemonitor,
    KEYs.view_searchrequests,
    KEYs.view_charts,
    KEYs.serial_ports,
    KEYs.telnet,
    KEYs.terminal,
    KEYs.adblogccat_stream,
    KEYs.serial_history_cmds
];

const DROPPING = [
    KEYs.view_serialsender,
    KEYs.view_markers,
    KEYs.view_statemonitor,
    KEYs.view_searchrequests,
    KEYs.view_charts,
    KEYs.serial_ports,
    KEYs.telnet,
    KEYs.terminal,
    KEYs.adblogccat_stream,
    KEYs.serial_history_cmds,
    KEYs.views,
    KEYs.shortcuts,
    KEYs.settings,
    KEYs.themes
];

const DESCRIPTION = {
    [KEYs.views]                : { caption: 'Views', description: 'Opened views; positions and sizes of views.'},
    [KEYs.shortcuts]            : { caption: 'Shortcuts', description: 'Allowed shortcuts in the system'},
    [KEYs.view_serialsender]    : { caption: 'Serial port sender view', description: 'Settings of serial port sender view'},
    [KEYs.view_markers]         : { caption: 'Markers', description: 'Collection of markers'},
    [KEYs.view_statemonitor]    : { caption: 'State monitor', description: 'Settings of state monitor view'},
    [KEYs.view_searchrequests]  : { caption: 'Search requests', description: 'Collection of used search requests'},
    [KEYs.view_charts]          : { caption: 'Charts', description: 'Settings of charts view'},
    [KEYs.serial_ports]         : { caption: 'Serial ports', description: 'Settings of serial ports'},
    [KEYs.telnet]               : { caption: 'Telnet', description: 'Settings and history of telnet channel'},
    [KEYs.terminal]             : { caption: 'Terminal', description: 'History of terminal commands'},
    [KEYs.themes]               : { caption: 'Themes', description: 'Information about currently used theme'},
    [KEYs.adblogccat_stream]    : { caption: 'ADB logcat', description: 'Settings and history of ADB logcat channel'},
    [KEYs.settings]             : { caption: 'Common settings', description: 'Visual settings; system settings and other common settings'},
    [KEYs.serial_history_cmds]  : { caption: 'Serial port sent history', description: 'History of commands sent to serial port'}
};

@Component({
    selector    : 'dialog-settings-importer',
    templateUrl : './template.html',
})

export class DialogSettingsManagerImporter extends TabController implements OnDestroy, AfterContentInit, AfterViewChecked, OnInit{

    @ViewChild ('exporturl', { read: ViewContainerRef}) exportURLNode: ViewContainerRef;

    private _exportingTotalCount: number = IMPORTING.length;
    private _droppingTotalCount: number = DROPPING.length;

    private _exporting: Array<{ key: string, selected: boolean, caption: string, description: string}> = IMPORTING.map((key)=>{
        return {
            key: key,
            selected: true,
            caption: DESCRIPTION[key].caption,
            description: DESCRIPTION[key].description
        }
    });

    private _dropping: Array<{ key: string, selected: boolean, caption: string, description: string}> = DROPPING.map((key)=>{
        return {
            key: key,
            selected: true,
            caption: DESCRIPTION[key].caption,
            description: DESCRIPTION[key].description
        }
    });

    public exportdata : {
        url         : any,
        filename    : string
    } = {
        url         : null,
        filename    : ''
    };

    private waitPopupGUID: symbol = Symbol();

    constructor(private componentFactoryResolver    : ComponentFactoryResolver,
                private viewContainerRef            : ViewContainerRef,
                private changeDetectorRef           : ChangeDetectorRef,
                private sanitizer                   : DomSanitizer) {
        super();
        this.onTabSelected = this.onTabSelected.bind(this);
        this.onTabDeselected = this.onTabDeselected.bind(this);
        this._onExportSelectAll = this._onExportSelectAll.bind(this);
        this._onExportDeselectAll = this._onExportDeselectAll.bind(this);
        this._onDropSelectAll = this._onDropSelectAll.bind(this);
        this._onDropDeselectAll = this._onDropDeselectAll.bind(this);
        this._onExport = this._onExport.bind(this);
        this._onDrop = this._onDrop.bind(this);
        this._onImport = this._onImport.bind(this);
    }

    ngOnInit(){
        this.onSelect   .subscribe(this.onTabSelected);
        this.onDeselect .subscribe(this.onTabDeselected);
    }

    ngOnDestroy(){
        this.onSelect.      unsubscribe();
        this.onDeselect.    unsubscribe();
    }

    ngAfterContentInit(){

    }

    ngAfterViewChecked(){
        if (this.exportdata.url !== null && this.exportURLNode !== null){
            this.exportURLNode.element.nativeElement.click();
            this.exportdata.url         = null;
            this.exportdata.filename    = '';
        }
    }

    onTabSelected(){

    }

    onTabDeselected(){

    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    * Export
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    _onExportSelectionChange(key: string, value: boolean){
        this._exporting = this._exporting.map((field) => {
            if (field.key === key) {
                field.selected = value;
            }
            return field;
        });
        this.forceUpdate();
    }

    _getKeysForExport(): Array<string>{
        return this._exporting.map((field) => {
            return field.selected ? field.key : null;
        }).filter((key) =>{
            return key !== null;
        });
    }

    _onExportSelectAll(){
        this._exporting = this._exporting.map((field) => {
            field.selected = true;
            return field;
        });
    }

    _onExportDeselectAll(){
        this._exporting = this._exporting.map((field) => {
            field.selected = false;
            return field;
        });
    }

    _onExport(){
        const toExportKeys = this._getKeysForExport();
        if (toExportKeys.length === 0) {
            return;
        }
        const settings = localSettings.get();
        const toExport = {};
        toExportKeys.forEach((key: string) =>{
            if (settings[key] !== void 0) {
                toExport[key] = settings[key];
            }
        });
        const blob  = new Blob([JSON.stringify(toExport)], {type: 'text/plain'});
        const url   = URL.createObjectURL(blob);
        this.exportdata.url = this.sanitizer.bypassSecurityTrustUrl(url);
        this.exportdata.filename = 'logviewer_settings_' + (new Date()).getTime() + '.json';
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    * Drop
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    _onDropSelectionChange(key: string, value: boolean){
        this._dropping = this._dropping.map((field) => {
            if (field.key === key) {
                field.selected = value;
            }
            return field;
        });
        this.forceUpdate();
    }

    _getKeysForDrop(): Array<string>{
        return this._dropping.map((field) => {
            return field.selected ? field.key : null;
        }).filter((key) =>{
            return key !== null;
        });
    }

    _onDropSelectAll(){
        this._dropping = this._dropping.map((field) => {
            field.selected = true;
            return field;
        });
    }

    _onDropDeselectAll(){
        this._dropping = this._dropping.map((field) => {
            field.selected = false;
            return field;
        });
    }

    _onDrop(){
        const toDropKeys = this._getKeysForDrop();
        if (toDropKeys.length === 0) {
            return;
        }
        let guid = Symbol();
        popupController.open({
            content : {
                factory     : null,
                component   : DialogMessage,
                params      : {
                    message: `Please, confirm dropping next settings: ${toDropKeys.map((key: string) => {
                        return DESCRIPTION[key].caption;
                    }).join('; ')}. Strongly recommend to make backup (export) before. After this operation logviewer will be restarted.`,
                    buttons: [
                        {
                            caption: 'Yes, drop it',
                            handle : () => {
                                this._dropSelectedSettings();
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

    _dropSelectedSettings(){
        const toDropKeys = this._getKeysForDrop();
        if (toDropKeys.length === 0) {
            return;
        }
        toDropKeys.forEach((key: string) => {
            localSettings.reset(key, 'Dropped by user');
        });
        location.reload();
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    * Import
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    _onImport(){
        let started = false;
        fileLoaderController.open(Symbol(), {
            load    : (data : string, files: Array<File>)=>{
                popupController.close(this.waitPopupGUID);
                let settings = {};
                try {
                    settings = JSON.parse(data);
                } catch (e) {
                    return this.showMessage('Error', `Fail read settings form this file`);
                }
                if (Object.keys(settings).length === 0) {
                    return this.showMessage('Error', `No any settings found in this file`);
                }
                let guid = Symbol();
                popupController.open({
                    content : {
                        factory     : null,
                        component   : DialogSettingsManagerImportConfirmation,
                        params      : {
                            settings: settings
                        }
                    },
                    title   : 'Import settings',
                    settings: {
                        move            : true,
                        resize          : true,
                        width           : '40rem',
                        height          : '40rem',
                        close           : true,
                        addCloseHandle  : true,
                        css             : ''
                    },
                    buttons         : [],
                    titlebuttons    : [],
                    GUID            : guid
                });

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

    showMessage(title: string, message: string){
        popupController.open({
            content : {
                factory     : null,
                component   : DialogMessage,
                params      : {
                    message: message,
                    buttons: []
                }
            },
            title   : title,
            settings: {
                move            : false,
                resize          : false,
                width           : '20rem',
                height          : '15rem',
                close           : false,
                addCloseHandle  : false,
                css             : ''
            },
            buttons         : [],
            titlebuttons    : [],
            GUID            : Symbol()
        });
    }

    forceUpdate(){
        this.changeDetectorRef.detectChanges();
    }

}
