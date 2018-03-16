import { Component, Input, ViewChild, ViewContainerRef, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { SimpleCheckbox } from '../../checkboxes/simple/component';
import { CommonInput } from '../../input/component';
import { APICommands } from "../../../../api/api.commands";
import { SimpleText } from "../../text/simple/component";
import { ProgressBarCircle } from "../../progressbar.circle/component";
import { popupController } from "../../popup/controller";
import { APIProcessor } from "../../../../api/api.processor";
import { APIResponse } from "../../../../api/api.response.interface";
import { SimpleListItem } from '../../lists/simple-drop-down/item.interface';
import {fileLoaderController} from "../../fileloader/controller";

@Component({
    selector    : 'dialog-adblogcatstream-settings',
    templateUrl : './template.html',
})

export class DialogADBLogcatStreamSettings implements AfterViewChecked{

    private _levels: Array<SimpleListItem> = [
        { caption: 'V', value: 'V' },
        { caption: 'I', value: 'I' },
        { caption: 'E', value: 'E' },
        { caption: 'D', value: 'D' },
        { caption: 'F', value: 'F' },
        { caption: 'S', value: 'S' },
        { caption: 'W', value: 'W' }
    ];

    @Input() filters    : Array<any>    = [];
    @Input() path       : string        = '';
    @Input() custom     : string        = '';
    @Input() reset      : boolean       = false;
    @Input() proceed    : Function      = null;
    @Input() cancel     : Function      = null;

    @ViewChild('_path'          ) _path             : CommonInput;
    @ViewChild('_custom'        ) _custom           : CommonInput;
    @ViewChild('_reset'         ) _reset            : SimpleCheckbox;
    @ViewChild('newFilter'      ) newFilterInput    : CommonInput;
    @ViewChild ('exporturl', { read: ViewContainerRef}) exportURLNode: ViewContainerRef;


    private progressGUID    : symbol    = Symbol();
    private processor       : any       = APIProcessor;
    private waitPopupGUID   : symbol    = Symbol();
    public exportdata       : {
        url         : any,
        filename    : string
    } = {
        url         : null,
        filename    : ''
    };

    constructor(private changeDetectorRef   : ChangeDetectorRef,
                private sanitizer: DomSanitizer) {
        this.onTest = this.onTest.bind(this);
        this.onProceed = this.onProceed.bind(this);
        this.onCustomChange = this.onCustomChange.bind(this);
        this.convertFilters();
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

    getSettings(){
        return {
            filters: this.serializeFilters(),
            path   : this._path.getValue(),
            reset  : this._reset.getValue(),
            custom : this._custom.getValue()
        };
    }

    onProceed(){
        this.proceed(this.getSettings());
    }

    onCustomChange(event: KeyboardEvent, value: string){

    }

    onTest(){
        this.showProgress(_('Please wait... Opening...'));
        let settings = this.getSettings();
        this.processor.send(
            APICommands.tryLogcatStream,
            {
                settings : settings
            },
            this.onTestDone.bind(this)
        );
    }

    onTestDone(response : APIResponse, error: Error){
        popupController.close(this.progressGUID);
        if (error === null){
            if (response.code === 0 && response.output === true){
                //Everything is cool.
                this.showMessage(_('Success'), `Current settings are correct.`);
            } else{
                this.showMessage(_('Error'), _('Server returned failed result. Code of error: ') + response.code + _('. Addition data: ') + response.output);
            }
        } else {
            this.showMessage(_('Error'), error.message);
        }
    }

    showMessage(title: string, message: string){
        popupController.open({
            content : {
                factory     : null,
                component   : SimpleText,
                params      : {
                    text: message
                }
            },
            title   : title,
            settings: {
                move            : true,
                resize          : true,
                width           : '20rem',
                height          : '10rem',
                close           : true,
                addCloseHandle  : true,
                css             : ''
            },
            buttons         : [],
            titlebuttons    : [],
            GUID            : Symbol()
        });
    }

    showProgress(caption : string){
        this.progressGUID = Symbol();
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
            GUID            : this.progressGUID
        });
    }

    convertFilters(){
        this.filters = this.filters.map((filter) => {
            return {
                value: filter.value,
                level: filter.level,
                edit: false
            };
        });
    }

    serializeFilters(){
        return this.filters.map((filter) => {
            return {
                value: filter.value,
                level: filter.level
            }
        });
    }

    onStartEditFilter(index: number){
        this.filters[index].edit = true;
    }

    onEndEditFilter(index: number, event:MouseEvent, value: string){
        this.filters[index].value = value;
        this.filters[index].edit = false;
    }

    onLevelChange(index: number, level: string){
        this.filters[index].level = level;
    }

    onFilterRemove(index: number){
        this.filters.splice(index, 1);
    }

    onNewFilter(){
        const value = this.newFilterInput.getValue();
        this.newFilterInput.setValue('');
        if (value.trim() === ''){
            return false;
        }
        this.filters.push({
            value: value,
            level: 'V',
            edit: false
        });
    }

    onExportFilters(){
        if (this.filters.length === 0) {
            return false;
        }
        let str     = JSON.stringify(this.filters),
            blob    = new Blob([str], {type: 'text/plain'}),
            url     = URL.createObjectURL(blob);
        this.exportdata.url         = this.sanitizer.bypassSecurityTrustUrl(url);
        this.exportdata.filename    = 'filters_adb_logcat_' + (new Date()).getTime() + '.json';
        this.forceUpdate();
    }

    onImportFilters(){
        let started = false;
        fileLoaderController.open(Symbol(), {
            load    : (data : string, files: Array<File>)=>{
                popupController.close(this.waitPopupGUID);
                let filters = this.validateFilters(data);
                if (filters !== null){
                    this.filters = filters;
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

    validateFilters(filters: any){
        let result = null;
        try {
            filters = JSON.parse(filters);
        } catch (e){
            filters = null;
        }
        if (filters instanceof Array){
            let valid = true;
            filters.forEach((filter) => {
                if (!valid){
                    return false;
                }
                if (typeof filter !== 'object' || filter === null) {
                    valid = false;
                } else if (typeof filter.value !== 'string' || filter.value.trim() === ''){
                    valid = false;
                }else if (typeof filter.level !== 'string' || filter.level.trim() === ''){
                    valid = false;
                }
            });
            if (valid) {
                result = filters;
            }
        }
        return result;
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

}
