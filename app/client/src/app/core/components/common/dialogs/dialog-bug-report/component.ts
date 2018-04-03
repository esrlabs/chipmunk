import { Component, ViewChild, ViewContainerRef, AfterViewChecked, Input } from '@angular/core';
import { dataController } from '../../../../../core/modules/controller.data';
import { localSettings  } from '../../../../../core/modules/controller.localsettings';

import { DomSanitizer   } from '@angular/platform-browser';
import {ANSIClearer} from "../../../../modules/tools.ansiclear";

const STAGES = {
    snapshot: Symbol(),
    logs: Symbol()
};
@Component({
    selector    : 'dialog-bug-report',
    templateUrl : './template.html',
})

export class DialogBugReport implements AfterViewChecked {

    @ViewChild ('exporturl', { read: ViewContainerRef}) exportURLNode: ViewContainerRef;
    @Input() closeHandler : Function = null;

    public exportdata       : {
        url         : any,
        filename    : string
    } = {
        url         : null,
        filename    : ''
    };

    private stage: symbol = STAGES.snapshot;

    constructor( private sanitizer : DomSanitizer) {
        this.onCreateReport = this.onCreateReport.bind(this);
    }

    ngAfterViewChecked(){
        if (this.exportdata.url !== null && this.exportURLNode !== null){
            this.exportURLNode.element.nativeElement.click();
            this.exportdata.url         = null;
            this.exportdata.filename    = '';
            setTimeout(()=>{
                switch (this.stage){
                    case STAGES.snapshot:
                        return this.getLogs();
                    case STAGES.logs:
                        typeof this.closeHandler === 'function' && this.closeHandler();
                        break;

                }
            }, 50);
        }
    }

    onCreateReport(){
        this.getSnapshot();
    }

    getSnapshot(){
        const snapshot = {
            data: dataController.getSnapshot(),
            settings: localSettings.get(),
            logs: ''
        };
        this.stage = STAGES.snapshot;
        try {
            let exporting = JSON.stringify(snapshot);
            let blob = new Blob([exporting], {type: 'text/plain'});
            let url = URL.createObjectURL(blob);
            this.exportdata.url = this.sanitizer.bypassSecurityTrustUrl(url);
            this.exportdata.filename = 'bug_report_' + (new Date()).getTime() + '.txt';
        } catch (e){
            this.getLogs();
            return 'error during making data snapshot';
        }
    }

    getLogs(){
        const logs = dataController.getSnapshot().rows.map((row: any)=>{
            return ANSIClearer(row.str);
        });
        this.stage = STAGES.logs;
        let blob = new Blob([[logs.join('\n')]], {type: 'text/plain'});
        let url = URL.createObjectURL(blob);
        this.exportdata.url = this.sanitizer.bypassSecurityTrustUrl(url);
        this.exportdata.filename = 'bug_report_logs' + (new Date()).getTime() + '.txt';
    }

}
