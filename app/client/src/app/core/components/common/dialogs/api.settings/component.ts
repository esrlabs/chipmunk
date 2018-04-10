import {Component, Input, Output, ViewChild, AfterContentInit, OnDestroy, OnInit } from '@angular/core';
import { CommonInput                } from '../../input/component';
import {IServerSetting, IVisualSettings} from '../../../../modules/controller.settings';
import {TabController} from "../../tabs/tab/class.tab.controller";

@Component({
    selector    : 'dialog-api-settings',
    templateUrl : './template.html',
})

export class DialogAPISettings extends TabController implements OnDestroy, AfterContentInit, OnInit{
    @Input() server             : IServerSetting    = null;
    @Input() proceed            : Function          = null;
    @Input() cancel             : Function          = null;
    @Input() register           : Function          = null;
    @Input() active             : boolean           = false;

    @Output() getData() : IServerSetting {
        return {
            API_URL                 : this._API_URL.getValue(),
            WS_URL                  : this._WS_URL.getValue(),
            WS_PROTOCOL             : this._WS_PROTOCOL.getValue(),
            WS_RECONNECTION_TIMEOUT : this._WS_RECONNECTION_TIMEOUT.getValue()
        };
    };

    private registered: boolean = false;

    @ViewChild('_API_URL'                   ) _API_URL                  : CommonInput;
    @ViewChild('_WS_URL'                    ) _WS_URL                   : CommonInput;
    @ViewChild('_WS_PROTOCOL'               ) _WS_PROTOCOL              : CommonInput;
    @ViewChild('_WS_RECONNECTION_TIMEOUT'   ) _WS_RECONNECTION_TIMEOUT  : CommonInput;

    constructor() {
        super();
        this.onProceed = this.onProceed.bind(this);
        this.onTabSelected              = this.onTabSelected.           bind(this);
        this.onTabDeselected            = this.onTabDeselected.         bind(this);
    }

    onTabSelected(){
        this.register({
            getData: this.getData.bind(this),
            section: 'server'
        });
    }

    onTabDeselected(){

    }

    ngOnInit(){
        this.onSelect   !== null && this.onSelect   .subscribe(this.onTabSelected);
        this.onDeselect !== null && this.onDeselect .subscribe(this.onTabDeselected);
    }

    ngOnDestroy(){
        this.onSelect   !== null && this.onSelect.      unsubscribe();
        this.onDeselect !== null && this.onDeselect.    unsubscribe();
    }

    ngAfterContentInit(){

    }

    onProceed(){
        typeof this.proceed === 'function' && this.proceed(this.getData());
    }

}
