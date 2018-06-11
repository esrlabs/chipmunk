import {
    Component, Input, Output, ViewChild, AfterContentInit, OnInit, ViewContainerRef,
    ComponentFactoryResolver, ChangeDetectorRef, OnDestroy, AfterViewChecked
} from '@angular/core';
import {DomSanitizer } from '@angular/platform-browser';
import { KEYs, localSettings} from '../../../../../../modules/controller.localsettings';
import {TabController} from "../../../../tabs/tab/class.tab.controller";
import {DialogMessage} from "../../../dialog-message/component";
import {popupController} from "../../../../popup/controller";
import {fileLoaderController} from "../../../../fileloader/controller";
import {ProgressBarCircle} from "../../../../progressbar.circle/component";

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
    selector    : 'dialog-settings-import-confirmation',
    templateUrl : './template.html',
})

export class DialogSettingsManagerImportConfirmation implements OnDestroy, AfterContentInit, AfterViewChecked, OnInit{

    @Input() settings: {[key:string]: any} = {};

    private _settings: Array<{ key: string, selected: boolean, caption: string, description: string}> = [];

    constructor(private componentFactoryResolver    : ComponentFactoryResolver,
                private viewContainerRef            : ViewContainerRef,
                private changeDetectorRef           : ChangeDetectorRef) {
        this._onImport = this._onImport.bind(this);
    }

    ngOnInit(){

    }

    ngOnDestroy(){

    }

    ngAfterContentInit(){
        if (this._settings.length === 0 && Object.keys(this.settings).length > 0) {
            Object.keys(this.settings).forEach((key: string) => {
                DESCRIPTION[key] !== void 0 && this._settings.push({
                    key: key,
                    selected: true,
                    caption: DESCRIPTION[key].caption,
                    description: DESCRIPTION[key].description
                });
            });
            this.forceUpdate();
        }
    }

    ngAfterViewChecked(){

    }

    _getKeysForImport(){
        return this._settings.map((field) => {
            return field.selected ? field.key : null;
        }).filter((key) =>{
            return key !== null;
        });
    }

    _onImportSelectionChange(key: string, value: boolean){
        this._settings = this._settings.map((field) => {
            if (field.key === key) {
                field.selected = value;
            }
            return field;
        });
        this.forceUpdate();
    }

    _onImport(){
        const toImportKeys = this._getKeysForImport();
        if (toImportKeys.length === 0) {
            return;
        }
        toImportKeys.forEach((key:string) => {
            localSettings.reset(key, 'Reset before import');
            localSettings.set({
                [key]: this.settings[key]
            });
        });
        location.reload();
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
