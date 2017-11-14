import {Component, Input, ChangeDetectorRef, AfterContentChecked        } from '@angular/core';
import {IndicateState, Indicate             } from '../../../../../views/statemonitor/statemonitor.monitor/item/interface';
import { popupController                    } from '../../../common/popup/controller';
import { StateMonitorStateEditIconsDialog   } from '../../../common/dialogs/statemonitor.state.edit.icons/component';

const
    EVENTS = {
        RESET_ALL_INDICATES: 'RESET_ALL_INDICATES'
    };

@Component({
    selector    : 'statemonitor-state-edit-dialog',
    templateUrl : './template.html',
})

export class StateMonitorStateEditDialog implements AfterContentChecked{
    @Input() callback           : Function      = null;
    @Input() state              : IndicateState = null;
    @Input() indicate           : Indicate      = null;

    private _inited             : boolean       = false;
    private _color              : string        = 'rgb(30,30,30)';
    private _css                : string        = '';
    private _icon               : string        = '';
    private _label              : string        = '';
    private _hook               : string        = '';
    private _reset              : boolean       = false;
    private _itSelfResetTimeout : number        = 0;

    private _effects        : Array<any>    = [
        {
            caption : 'No Effects',
            value   : ''
        },
        {
            caption : 'Blinking',
            value   : 'monitor-icon-blink'
        },
        {
            caption : 'Rotate',
            value   : 'monitor-icon-rotate'
        },
    ];

    constructor(private changeDetectorRef : ChangeDetectorRef){
        this.changeDetectorRef      = changeDetectorRef;
        this.onColorChange          = this.onColorChange.bind(this);
        this.onChangeEffect         = this.onChangeEffect.bind(this);
        this.onIconChange           = this.onIconChange.bind(this);
        this.onLabelChange          = this.onLabelChange.bind(this);
        this.onHookChange           = this.onHookChange.bind(this);
        this.onResetChange          = this.onResetChange.bind(this);
        this.onItSelfResetTimeout   = this.onItSelfResetTimeout.bind(this);
        this.onSave                 = this.onSave.bind(this);
        this.onCancel               = this.onCancel.bind(this);
    }

    ngAfterContentChecked(){
        if (this.state !== null && !this._inited){
            if (this.state.color !== '' && typeof this.state.color === 'string'){
                this._color = this.state.color;
            }
            if (this.state.css !== '' && typeof this.state.css === 'string'){
                this._css = this.state.css;
            }
            if (this.state.icon !== '' && typeof this.state.icon === 'string'){
                this._icon = this.state.icon;
            }
            if (this.state.label !== '' && typeof this.state.label === 'string'){
                this._label = this.state.label;
            }
            if (this.state.hook !== '' && typeof this.state.hook === 'string'){
                this._hook = this.state.hook;
            }
            if (this.state.event instanceof Array){
                this._reset = this.state.event.indexOf(EVENTS.RESET_ALL_INDICATES) !== -1;
            } else {
                this._reset = false;
            }
            if (typeof this.state.offInTimeout === 'number'){
                this._itSelfResetTimeout = this.state.offInTimeout;
            } else {
                this._itSelfResetTimeout = 0;
            }
            this._inited = true;
        }
    }

    forceUpdate(){
        this.changeDetectorRef.detectChanges();
    }

    onColorChange(color: string){
        this._color = color;
        this.forceUpdate();
    }

    onChangeEffect(css: string){
        this._css = css;
        this.forceUpdate();
    }

    onIconChange(){
        let popup = Symbol();
        popupController.open({
            content : {
                factory     : null,
                component   : StateMonitorStateEditIconsDialog,
                params      : {
                    callback            : function(icon: string){
                        this._icon = icon;
                        this.forceUpdate();
                        popupController.close(popup);
                    }.bind(this)
                }
            },
            title   : _('Choose an icon'),
            settings: {
                move            : true,
                resize          : true,
                width           : '40rem',
                height          : '40rem',
                close           : true,
                addCloseHandle  : true,
                css             : ''
            },
            titlebuttons    : [],
            GUID            : popup
        });
    }

    onLabelChange(event: KeyboardEvent){
        this._label = event.target['value'];
        this.forceUpdate();
    }

    onHookChange(event: KeyboardEvent){
        this._hook = event.target['value'];
        this.forceUpdate();
    }

    onResetChange(value: boolean){
        this._reset = value;
        this.forceUpdate();
    }

    onItSelfResetTimeout(event: KeyboardEvent){
        this._itSelfResetTimeout = parseInt(event.target['value'], 10);
        typeof this._itSelfResetTimeout !== 'number'    && (this._itSelfResetTimeout = 0);
        isNaN(this._itSelfResetTimeout)                 && (this._itSelfResetTimeout = 0);
        this.forceUpdate();
    }

    getEventName(){
        let events = [];
        if (this._reset){
            events.push(EVENTS.RESET_ALL_INDICATES);
        }
        return events;
    }

    onSave(){
        typeof this.callback === 'function' && this.callback({
            label           : this._label,
            hook            : this._hook,
            color           : this._color,
            offInTimeout    : this._itSelfResetTimeout,
            event           : this.getEventName(),
            css             : this._css,
            icon            : this._icon,
            defaults        : this.state.defaults
        } as IndicateState);
    }

    onCancel(){
        typeof this.callback === 'function' && this.callback(null);
    }


}

