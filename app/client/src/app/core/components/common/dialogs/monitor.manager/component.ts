import { Component, Input, AfterContentInit, OnInit, EventEmitter, ComponentFactoryResolver } from '@angular/core';

import { Tab                            } from '../../tabs/interface.tab';
import { DialogMonitorManagerSettingTab } from './settings/component';
import { DialogMonitorManagerLogsTab    } from './logs/component';
import { MonitorState                   } from '../../../../handles/hanlde.open.monitor.manager';

@Component({
    selector    : 'dialog-monitor-manager',
    templateUrl : './template.html',
})

export class DialogMonitorManager implements OnInit{

    @Input() maxFileSizeMB          : number        = 100;
    @Input() maxFilesCount          : number        = 10;
    @Input() port                   : string        = '';
    @Input() portSettings           : any           = {};
    @Input() ports                  : Array<string> = [];
    @Input() state                  : MonitorState  = null;

    @Input() files                  : Array<string> = [];
    @Input() register               : any           = {};

    @Input() getFileContent         : Function      = null;
    @Input() getAllFilesContent     : Function      = null;
    @Input() getMatches             : Function      = null;
    @Input() stopAndClearMonitor    : Function      = null;
    @Input() restartMonitor         : Function      = null;
    @Input() setSettingsOfMonitor   : Function      = null;
    @Input() clearLogsOfMonitor     : Function      = null;
    @Input() getStateMonitor        : Function      = null;
    @Input() getFilesInfo           : Function      = null;

    private tabs                    : Array<Tab>    = [];
    private onResize                : EventEmitter<null>    = new EventEmitter();

    constructor(private componentFactoryResolver    : ComponentFactoryResolver) {
    }

    ngOnInit(){
        this.initTabs();
    }

    initTabs(){
        let emitterResultsSelect    = new EventEmitter<any>(),
            emitterRequestsSelect   = new EventEmitter<any>(),
            emitterResultsDeselect  = new EventEmitter<any>(),
            emitterRequestsDeselect = new EventEmitter<any>(),
            emitterResultsResize    = new EventEmitter<any>(),
            emitterRequestsResize   = new EventEmitter<any>();
        this.tabs.push({
            id          : Symbol(),
            label       : 'Settings',
            onSelect    : emitterResultsSelect,
            onDeselect  : emitterResultsDeselect,
            onResize    : emitterResultsResize,
            factory     : this.componentFactoryResolver.resolveComponentFactory(DialogMonitorManagerSettingTab),
            params      : {
                ports               : this.ports,
                maxFileSizeMB       : this.maxFileSizeMB,
                maxFilesCount       : this.maxFilesCount,
                portSettings        : this.portSettings,
                port                : this.port,
                state               : this.state,
                onSelect            : emitterResultsSelect,
                onDeselect          : emitterResultsDeselect,
                onResize            : emitterResultsResize,
                stopAndClearMonitor : this.stopAndClearMonitor,
                restartMonitor      : this.restartMonitor,
                setSettingsOfMonitor: this.setSettingsOfMonitor,
                clearLogsOfMonitor  : this.clearLogsOfMonitor,
                getStateMonitor     : this.getStateMonitor
            },
            update      : null,
            active      : true
        });
        this.tabs.push({
            id          : Symbol(),
            label       : 'Logs',
            onSelect    : emitterRequestsSelect,
            onDeselect  : emitterRequestsDeselect,
            onResize    : emitterResultsResize,
            factory     : this.componentFactoryResolver.resolveComponentFactory(DialogMonitorManagerLogsTab),
            params      : {
                files               : this.files,
                register            : this.register,
                getFileContent      : this.getFileContent,
                getAllFilesContent  : this.getAllFilesContent,
                getMatches          : this.getMatches,
                getFilesInfo        : this.getFilesInfo,
                onSelect            : emitterRequestsSelect,
                onDeselect          : emitterRequestsDeselect,
                onResize            : emitterResultsResize
            },
            update      : null,
            active      : false
        });
    }
}
