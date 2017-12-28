import {
    Component, Input, ViewChild, AfterContentInit, OnInit, EventEmitter, ViewContainerRef,
    ComponentFactoryResolver, ChangeDetectorRef, OnDestroy
} from '@angular/core';
import { CommonInput                    } from '../../../input/component';
import {popupController                 } from "../../../popup/controller";
import {DialogSerialSettings            } from "../../serial.settings/component";
import {configuration as Configuration  } from "../../../../../modules/controller.config";
import {events as Events                } from "../../../../../modules/controller.events";
import { TabController                  } from '../../../../common/tabs/tab/class.tab.controller';
import { DefaultsPortSettings           } from '../../serial.settings/defaults.settings';
import { ProgressBarCircle              } from "../../../progressbar.circle/component";
import { MonitorState                   } from '../../../../../handles/hanlde.open.monitor.manager';
import { SimpleDropDownList             } from '../../../lists/simple-drop-down/component';

@Component({
    selector    : 'dialog-monitor-manager-settings-tab',
    templateUrl : './template.html',
})

export class DialogMonitorManagerSettingTab extends TabController implements OnDestroy, AfterContentInit, OnInit{

    @Input() maxFileSizeMB          : number        = 100;
    @Input() maxFilesCount          : number        = 10;
    @Input() port                   : string        = '';
    @Input() portSettings           : any           = {};
    @Input() ports                  : Array<string> = [];
    @Input() state                  : MonitorState  = {
        active  : false,
        port    : ''
    };

    @Input() stopAndClearMonitor    : Function      = null;
    @Input() restartMonitor         : Function      = null;
    @Input() setSettingsOfMonitor   : Function      = null;
    @Input() clearLogsOfMonitor     : Function      = null;
    @Input() getStateMonitor        : Function      = null;

    @ViewChild('_maxFileSizeMB' ) _maxFileSizeMB    : CommonInput;
    @ViewChild('_maxFilesCount' ) _maxFilesCount    : CommonInput;
    @ViewChild('_port'          ) _port             : SimpleDropDownList;


    private portsList   : Array<any>    = [];

    constructor(private componentFactoryResolver    : ComponentFactoryResolver,
                private viewContainerRef            : ViewContainerRef,
                private changeDetectorRef           : ChangeDetectorRef) {
        super();
        this.onTabSelected              = this.onTabSelected.           bind(this);
        this.onTabDeselected            = this.onTabDeselected.         bind(this);
        this.onClearLogsOfMonitor       = this.onClearLogsOfMonitor.    bind(this);
        this.onRestartMonitor           = this.onRestartMonitor.        bind(this);
        this.onSetSettingsOfMonitor     = this.onSetSettingsOfMonitor.  bind(this);
        this.onStopMonitor              = this.onStopMonitor.           bind(this);
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
        if (this.ports instanceof Array) {
            this.portsList = this.ports.map((port) => {
                return {
                    caption: port,
                    value: port
                };
            });
        }
    }

    showProgress(caption : string){
        let GUID = Symbol();
        popupController.open({
            content : {
                factory     : null,
                component   : ProgressBarCircle,
                params      : {}
            },
            title   : caption,
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
        return GUID;
    }


    onTabSelected(){

    }

    onTabDeselected(){

    }

    showPortSettings(){
        let GUID        = Symbol();
        let settings    = typeof this.portSettings === 'object' ? (this.portSettings !== null ? this.portSettings : {}) : {};
        let params      = Object.assign({
            proceed : function (GUID: symbol, settings: any) {
                this.portSettings = settings;
                popupController.close(GUID);
            }.bind(this, GUID),
            cancel  : function (GUID: symbol) {
                popupController.close(GUID);
            }.bind(this, GUID)
        }, settings);
        popupController.open({
            content : {
                factory     : null,
                component   : DialogSerialSettings,
                params      : params
            },
            title   : _('Configuration of port: '),
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
            GUID            : GUID
        });
    }

    onClearLogsOfMonitor(){
        let GUID = this.showProgress('Please wait...');
        this.clearLogsOfMonitor((result: boolean) => {
            this.getStateMonitor((state: MonitorState) => {
                this.state = state !== null ? state : { active: false, port: ''};
                popupController.close(GUID);
                this.forceUpdate();
            });
        });
    }

    onRestartMonitor(){
        let GUID = this.showProgress('Please wait...');
        this.restartMonitor((result: boolean) => {
            this.getStateMonitor((state: MonitorState) => {
                this.state = state !== null ? state : { active: false, port: ''};
                popupController.close(GUID);
                this.forceUpdate();
            });
        });
    }

    onSetSettingsOfMonitor(){
        this.updateSettings();
        let GUID = this.showProgress('Please wait...');
        this.setSettingsOfMonitor((result: boolean) => {
            this.getStateMonitor((state: MonitorState) => {
                this.state = state !== null ? state : { active: false, port: ''};
                popupController.close(GUID);
                this.forceUpdate();
            });
        },{
            maxFilesCount   : this.maxFilesCount,
            maxFileSizeMB   : this.maxFileSizeMB,
            port            : this.port,
            portSettings    : this.portSettings
        });
    }

    onStopMonitor(){
        this.updateSettings();
        this.port   = '';
        let GUID    = this.showProgress('Please wait...');
        this.setSettingsOfMonitor((result: boolean) => {
            this.getStateMonitor((state: MonitorState) => {
                this.state = state !== null ? state : { active: false, port: ''};
                popupController.close(GUID);
                this.forceUpdate();
            });
        },{
            maxFilesCount   : this.maxFilesCount,
            maxFileSizeMB   : this.maxFileSizeMB,
            port            : this.port,
            portSettings    : this.portSettings
        });
    }

    updateSettings() {
        this.maxFilesCount  = parseInt(this._maxFilesCount.getValue(), 10);
        this.maxFileSizeMB  = parseInt(this._maxFileSizeMB.getValue(), 10);
        this.port           = this._port.getValue();
        let validSettings   = true;
        if (this.portSettings === null || typeof this.portSettings !== 'object') {
            validSettings   = false;
        } else {
            let defaults    = new DefaultsPortSettings();
            Object.keys(defaults).forEach((key)=>{
                if (this.portSettings[key] === void 0 || typeof this.portSettings[key] !== typeof defaults[key]){
                    validSettings = false;
                }
            });
        }
        !validSettings && (this.portSettings = new DefaultsPortSettings());
    }

    forceUpdate(){
        this.changeDetectorRef.detectChanges();
    }

}
