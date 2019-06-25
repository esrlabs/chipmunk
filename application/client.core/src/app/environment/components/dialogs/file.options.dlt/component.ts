import { Component, Input, OnDestroy, ChangeDetectorRef, AfterContentInit, ViewChild } from '@angular/core';
import { DDListStandardComponent } from 'logviewer-client-primitive';

export enum EMTIN {
    // If MSTP == DLT_TYPE_LOG
    DLT_LOG_FATAL           = 'DLT_LOG_FATAL',
    DLT_LOG_ERROR           = 'DLT_LOG_ERROR',
    DLT_LOG_WARN            = 'DLT_LOG_WARN',
    DLT_LOG_INFO            = 'DLT_LOG_INFO',
    DLT_LOG_DEBUG           = 'DLT_LOG_DEBUG',
    DLT_LOG_VERBOSE         = 'DLT_LOG_VERBOSE',
    // If MSTP == DLT_TYPE_APP_TRACE
    DLT_TRACE_VARIABLE      = 'DLT_TRACE_VARIABLE',
    DLT_TRACE_FUNCTION_IN   = 'DLT_TRACE_FUNCTION_IN',
    DLT_TRACE_FUNCTION_OUT  = 'DLT_TRACE_FUNCTION_OUT',
    DLT_TRACE_STATE         = 'DLT_TRACE_STATE',
    DLT_TRACE_VFB           = 'DLT_TRACE_VFB',
    // If MSTP == DLT_TYPE_NW_TRACE
    DLT_NW_TRACE_IPC        = 'DLT_NW_TRACE_IPC',
    DLT_NW_TRACE_CAN        = 'DLT_NW_TRACE_CAN',
    DLT_NW_TRACE_FLEXRAY    = 'DLT_NW_TRACE_FLEXRAY',
    DLT_NW_TRACE_MOST       = 'DLT_NW_TRACE_MOST',
    // If MSTP == DLT_TYPE_CONTROL
    DLT_CONTROL_REQUEST     = 'DLT_CONTROL_REQUEST',
    DLT_CONTROL_RESPONSE    = 'DLT_CONTROL_RESPONSE',
    DLT_CONTROL_TIME        = 'DLT_CONTROL_TIME',
    // Default
    UNDEFINED               = 'UNDEFINED',
}

const CLogsLevels = {
    [EMTIN.DLT_LOG_VERBOSE]: [ EMTIN.DLT_LOG_VERBOSE, EMTIN.DLT_LOG_DEBUG, EMTIN.DLT_LOG_INFO, EMTIN.DLT_LOG_WARN, EMTIN.DLT_LOG_ERROR, EMTIN.DLT_LOG_FATAL ],
    [EMTIN.DLT_LOG_DEBUG]: [ EMTIN.DLT_LOG_DEBUG, EMTIN.DLT_LOG_INFO, EMTIN.DLT_LOG_WARN, EMTIN.DLT_LOG_ERROR, EMTIN.DLT_LOG_FATAL ],
    [EMTIN.DLT_LOG_INFO]: [ EMTIN.DLT_LOG_INFO, EMTIN.DLT_LOG_WARN, EMTIN.DLT_LOG_ERROR, EMTIN.DLT_LOG_FATAL ],
    [EMTIN.DLT_LOG_WARN]: [ EMTIN.DLT_LOG_WARN, EMTIN.DLT_LOG_ERROR, EMTIN.DLT_LOG_FATAL ],
    [EMTIN.DLT_LOG_ERROR]: [ EMTIN.DLT_LOG_ERROR, EMTIN.DLT_LOG_FATAL ],
    [EMTIN.DLT_LOG_FATAL]: [ EMTIN.DLT_LOG_FATAL ],
};

const CRestMTINTypes = [
    EMTIN.DLT_TRACE_VARIABLE,
    EMTIN.DLT_TRACE_FUNCTION_IN,
    EMTIN.DLT_TRACE_FUNCTION_OUT,
    EMTIN.DLT_TRACE_STATE,
    EMTIN.DLT_TRACE_STATE,
    EMTIN.DLT_TRACE_VFB,
    EMTIN.DLT_NW_TRACE_IPC,
    EMTIN.DLT_NW_TRACE_CAN,
    EMTIN.DLT_NW_TRACE_FLEXRAY,
    EMTIN.DLT_NW_TRACE_MOST,
    EMTIN.DLT_CONTROL_REQUEST,
    EMTIN.DLT_CONTROL_RESPONSE,
    EMTIN.DLT_CONTROL_TIME,
    EMTIN.UNDEFINED,
];

@Component({
    selector: 'app-views-dialogs-file-options-dlt',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class DialogsFileOptionsDltComponent implements OnDestroy, AfterContentInit {

    @Input() public fullFileName: string = '';
    @Input() public fileName: string = '';
    @Input() public size: number = -1;
    @Input() public onDone: (options: any) => void;
    @Input() public onCancel: () => void;

    public _ng_size: string = '';
    public _ng_logLevelDefault: EMTIN = EMTIN.DLT_LOG_VERBOSE;
    public _ng_logLevels: Array<{ value: string; caption: string}> = [
        { value: EMTIN.DLT_LOG_FATAL, caption: 'Fatal' },
        { value: EMTIN.DLT_LOG_ERROR, caption: 'Error' },
        { value: EMTIN.DLT_LOG_WARN, caption: 'Warnings' },
        { value: EMTIN.DLT_LOG_INFO, caption: 'Info' },
        { value: EMTIN.DLT_LOG_DEBUG, caption: 'Debug' },
        { value: EMTIN.DLT_LOG_VERBOSE, caption: 'Verbose' },
    ];

    private _logLevel: EMTIN = EMTIN.DLT_LOG_VERBOSE;

    constructor(private _cdRef: ChangeDetectorRef) {
        this._ng_onLogLevelChange = this._ng_onLogLevelChange.bind(this);
    }

    public ngAfterContentInit() {
        this._ng_size = `${(this.size / 1024 / 1024).toFixed(2)}Mb`;
    }

    public ngOnDestroy() {
    }

    public _ng_onLogLevelChange(value: EMTIN) {
        this._logLevel = value;
    }

    public _ng_onOpen() {
        this.onDone({
            MTIN: [...CLogsLevels[this._logLevel], ...CRestMTINTypes]
        });
    }

    public _ng_onCancel() {
        this.onCancel();
    }

}
