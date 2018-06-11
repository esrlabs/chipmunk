import {
    Component, Input, ViewChild, AfterContentInit, OnInit, ViewContainerRef, OnDestroy, AfterViewChecked
} from '@angular/core';
import {DomSanitizer } from '@angular/platform-browser';
import { KEYs, localSettings} from '../../../../../../modules/controller.localsettings';

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

@Component({
    selector    : 'dialog-settings-auto-export',
    templateUrl : './template.html',
})

export class DialogSettingsAutoExport implements OnDestroy, AfterContentInit, AfterViewChecked, OnInit{

    @ViewChild ('exporturl', { read: ViewContainerRef}) exportURLNode: ViewContainerRef;

    @Input() onFinish: Function = null;

    public exportdata : {
        url         : any,
        filename    : string
    } = {
        url         : null,
        filename    : ''
    };

    private _done: boolean = false;

    constructor(private sanitizer: DomSanitizer) {
    }

    ngOnInit(){

    }

    ngOnDestroy(){

    }

    ngAfterContentInit(){
        if (this.onFinish !== null && !this._done){
            this._export();
        }
    }

    ngAfterViewChecked(){
        if (this.exportdata.url !== null && this.exportURLNode !== null){
            this.exportURLNode.element.nativeElement.click();
            this.exportdata.url         = null;
            this.exportdata.filename    = '';
        }
    }

    _export(){
        const settings = localSettings.get();
        const toExport = {};
        IMPORTING.forEach((key: string) =>{
            if (settings[key] !== void 0) {
                toExport[key] = settings[key];
            }
        });
        const blob  = new Blob([JSON.stringify(toExport)], {type: 'text/plain'});
        const url   = URL.createObjectURL(blob);
        this.exportdata.url = this.sanitizer.bypassSecurityTrustUrl(url);
        this.exportdata.filename = 'logviewer_settings_' + (new Date()).getTime() + '.json';
        setTimeout(this.onFinish, 3000);
    }


}
