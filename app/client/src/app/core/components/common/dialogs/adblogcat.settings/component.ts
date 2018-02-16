import {Component, Input, ViewChild } from '@angular/core';
import { SimpleCheckbox             } from '../../checkboxes/simple/component';
import { CommonInput                } from '../../input/component';
import {APICommands} from "../../../../api/api.commands";
import {SimpleText} from "../../text/simple/component";
import {ProgressBarCircle} from "../../progressbar.circle/component";
import {popupController} from "../../popup/controller";
import {APIProcessor} from "../../../../api/api.processor";
import {APIResponse} from "../../../../api/api.response.interface";
@Component({
    selector    : 'dialog-adblogcatstream-settings',
    templateUrl : './template.html',
})

export class DialogADBLogcatStreamSettings {
    @Input() V          : boolean       = true;
    @Input() I          : boolean       = true;
    @Input() D          : boolean       = true;
    @Input() W          : boolean       = true;
    @Input() E          : boolean       = true;
    @Input() S          : boolean       = true;
    @Input() F          : boolean       = true;
    @Input() tid        : number        = -1;
    @Input() pid        : number        = -1;
    @Input() path       : string        = '';
    @Input() custom     : string        = '';
    @Input() reset      : boolean       = false;
    @Input() proceed    : Function      = null;
    @Input() cancel     : Function      = null;

    @ViewChild('_level_V'       ) _level_V  : SimpleCheckbox;
    @ViewChild('_level_I'       ) _level_I  : SimpleCheckbox;
    @ViewChild('_level_D'       ) _level_D  : SimpleCheckbox;
    @ViewChild('_level_W'       ) _level_W  : SimpleCheckbox;
    @ViewChild('_level_E'       ) _level_E  : SimpleCheckbox;
    @ViewChild('_level_S'       ) _level_S  : SimpleCheckbox;
    @ViewChild('_level_F'       ) _level_F  : SimpleCheckbox;
    @ViewChild('_tid'           ) _tid      : CommonInput;
    @ViewChild('_pid'           ) _pid      : CommonInput;
    @ViewChild('_path'          ) _path     : CommonInput;
    @ViewChild('_custom'        ) _custom     : CommonInput;
    @ViewChild('_reset'         ) _reset    : SimpleCheckbox;

    private progressGUID    : symbol    = Symbol();
    private processor       : any       = APIProcessor;

    constructor() {
        this.onTest = this.onTest.bind(this);
        this.onProceed = this.onProceed.bind(this);
        this.onCustomChange = this.onCustomChange.bind(this);
    }

    getSettings(){
        let levels = {};
        ['V', 'I', 'E', 'D', 'F', 'S', 'W'].forEach((key)=>{
            levels[key] = this['_level_' + key].getValue();
        });
        return {
            levels : levels,
            tid    : parseInt(this._tid.getValue(), 10),
            pid    : parseInt(this._pid.getValue(), 10),
            path   : this._path.getValue(),
            reset  : this._reset.getValue(),
            custom : this._custom.getValue()
        };
    }

    convert(settings: any) {
        let tags: Array<string> = [];
        ['V', 'I', 'E', 'D', 'F', 'S', 'W'].forEach((key)=>{
            settings.levels[key] && tags.push(key);
        });
        return {
            pid     : settings.pid > 0 ? settings.pid.toString() : '',
            tid     : settings.tid > 0 ? settings.tid.toString() : '',
            tags    : tags.length === 7 ? null : tags,
            path    : settings.path !== void 0 ? settings.path : '',
            reset   : settings.reset !== void 0 ? settings.reset : false,
            custom  : settings.custom !== void 0 ? settings.custom : ''
        }
    }

    onProceed(){
        this.proceed(this.getSettings());
    }

    onCustomChange(event: KeyboardEvent, value: string){
        /*
        if (value !== ''){
            this.disableControls();
        } else {
            this.enableControls();
        }
        */
    }

    enableControls(){
        ['V', 'I', 'E', 'D', 'F', 'S', 'W'].forEach((key)=>{
            this['_level_' + key].enable();
        });
        this._pid.enable();
        this._tid.enable();
    }

    disableControls(){
        ['V', 'I', 'E', 'D', 'F', 'S', 'W'].forEach((key)=>{
            this['_level_' + key].disable();
        });
        this._pid.disable();
        this._tid.disable();
    }

    onTest(){
        this.showProgress(_('Please wait... Opening...'));
        let settings = this.getSettings()
        this.processor.send(
            APICommands.tryLogcatStream,
            {
                settings : this.convert(settings)
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

}
