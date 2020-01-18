import { Component, Input, OnDestroy, ChangeDetectorRef, AfterContentInit, ViewChildren, QueryList } from '@angular/core';
import ElectronIpcService, { IPCMessages } from '../../../services/service.electron.ipc';
import * as Toolkit from 'chipmunk.client.toolkit';
import { NotificationsService, ENotificationType } from '../../../services.injectable/injectable.service.notifications';
import TabsSessionsService from '../../../services/service.sessions.tabs';
import { CommonInterfaces } from '../../../interfaces/interface.common';
import { Subject } from 'rxjs';
import { DialogsFileOptionsDltStatsComponent, IStatRow, IForceSortData } from './stats/component';

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

const CLogLevel = {
    [EMTIN.DLT_LOG_FATAL]: 1,
    [EMTIN.DLT_LOG_ERROR]: 2,
    [EMTIN.DLT_LOG_WARN]: 3,
    [EMTIN.DLT_LOG_INFO]: 4,
    [EMTIN.DLT_LOG_DEBUG]: 5,
    [EMTIN.DLT_LOG_VERBOSE]: 6,
};

const CStatCaptions = {
    app_ids: 'APID',
    context_ids: 'CTID',
    ecu_ids: 'ECUID',
};

const CLevels = {
    non_log: 'non_log',
    log_fatal: 'log_fatal',
    log_error: 'log_error',
    log_warning: 'log_warning',
    log_info: 'log_info',
    log_debug: 'log_debug',
    log_verbose: 'log_verbose',
    log_invalid: 'log_invalid',
};

const CLevelOrder = [
    CLevels.log_fatal,
    CLevels.log_error,
    CLevels.log_warning,
    CLevels.log_info,
    CLevels.log_debug,
    CLevels.log_verbose,
    CLevels.non_log,
    CLevels.log_invalid,
];

interface IStatData {
    caption: string;
    stats: IStatRow[];
}

interface IStats {
    app_ids: IStatData;
    context_ids: IStatData;
    ecu_ids: IStatData;
}

@Component({
    selector: 'app-views-dialogs-file-options-dlt',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class DialogsFileOptionsDltComponent implements OnDestroy, AfterContentInit {

    @ViewChildren(DialogsFileOptionsDltStatsComponent) public _ng_sectionsRefs: QueryList<DialogsFileOptionsDltStatsComponent>;

    @Input() public fullFileName: string = '';
    @Input() public fileName: string = '';
    @Input() public size: number = -1;
    @Input() public onDone: (options: CommonInterfaces.DLT.IDLTOptions) => void;
    @Input() public onCancel: () => void;

    public _ng_size: string = '';
    public _ng_logLevelDefault: EMTIN = EMTIN.DLT_LOG_VERBOSE;
    public _ng_scanning: boolean = true;
    public _ng_sortByLogLevel: number = -1;
    public _ng_logLevels: Array<{ value: string; caption: string}> = [
        { value: EMTIN.DLT_LOG_FATAL, caption: 'Fatal' },
        { value: EMTIN.DLT_LOG_ERROR, caption: 'Error' },
        { value: EMTIN.DLT_LOG_WARN, caption: 'Warnings' },
        { value: EMTIN.DLT_LOG_INFO, caption: 'Info' },
        { value: EMTIN.DLT_LOG_DEBUG, caption: 'Debug' },
        { value: EMTIN.DLT_LOG_VERBOSE, caption: 'Verbose' },
    ];
    public _ng_filters: IStats | undefined = undefined;
    public _ng_fibexFile: IPCMessages.IFilePickerFileInfo | undefined;
    public _ng_error: string | undefined;
    public _ng_dispayed = ['id', ...CLevelOrder];
    public _ng_filterSubject: Subject<string> = new Subject<string>();
    public _ng_filterValue: string = '';
    public _ng_sortSubject: Subject<IForceSortData> = new Subject<IForceSortData>();

    private _logLevel: EMTIN = EMTIN.DLT_LOG_VERBOSE;
    private _stats: CommonInterfaces.DLT.StatisticInfo | undefined;
    private _destroyed: boolean = false;
    private _requestId: string | undefined;
    private _logger: Toolkit.Logger = new Toolkit.Logger(`DialogsFileOptionsDltComponent`);

    constructor(private _cdRef: ChangeDetectorRef,
                private _notifications: NotificationsService) {
        this._ng_onLogLevelChange = this._ng_onLogLevelChange.bind(this);
    }

    public ngAfterContentInit() {
        this._ng_size = `${(this.size / 1024 / 1024).toFixed(2)}Mb`;
        const session: string = TabsSessionsService.getActive().getGuid();
        this._requestId = Toolkit.guid();
        ElectronIpcService.request(new IPCMessages.DLTStatsRequest({
            file: this.fullFileName,
            id: this._requestId,
            session: 'none',
        }), IPCMessages.DLTStatsResponse).then((response: IPCMessages.DLTStatsResponse) => {
            this._requestId = undefined;
            this._ng_scanning = false;
            if (typeof response.error === 'string' && response.error.trim() !== '') {
                this._ng_error = response.error;
                this._notifications.add({
                    caption: `Errors during scan ${this.fileName}`,
                    message: response.error,
                    session: response.session,
                    options: {
                        type: ENotificationType.error,
                    }
                });
                this._forceUpdate();
                return;
            }
            this._stats = response.stats;
            this._setFilters();
        }).catch((error: Error) => {
            this._ng_scanning = false;
            this._ng_error = error.message;
            this._forceUpdate();
            this._notifications.add({
                caption: `Fail to scan ${this.fileName}`,
                message: error.message,
                session: session,
                options: {
                    type: ENotificationType.error,
                }
            });
        });
    }

    public ngOnDestroy() {
        this._destroyed = true;
        if (this._requestId !== undefined) {
            this._logger.env(`Canceling DLT stats getting by request "${this._requestId}"`);
            ElectronIpcService.request(new IPCMessages.DLTStatsCancelRequest({
                id: this._requestId,
                session: 'none',
            }), IPCMessages.DLTStatsCancelResponse).then((response: IPCMessages.DLTStatsResponse) => {
                this._requestId = undefined;
                this._logger.env(`Canceled DLT stats getting`);
            }).catch((error: Error) => {
                this._requestId = undefined;
                this._logger.warn(`Fail to cancel DLT stats getting due error: ${error.message}`);
            });
        }
    }

    public _ng_onLogLevelChange(value: EMTIN) {
        this._logLevel = value;
    }

    public _ng_onOpen() {
        const filters: CommonInterfaces.DLT.IDLTFilters = {};
        this._ng_sectionsRefs.map((section: DialogsFileOptionsDltStatsComponent) => {
            filters[section.getId()] = section.getSelected();
        });
        this.onDone({
            logLevel: CLogLevel[this._logLevel],
            filters: filters,
            // TODO Dmitry
            fibexFilePath: this._ng_fibexFile === undefined ? undefined : { fibex_file_paths: [this._ng_fibexFile.path]},
        });
    }

    public _ng_onCancel() {
        this.onCancel();
    }

    public _ng_onFibex() {
        ElectronIpcService.request(new IPCMessages.FilePickerRequest({
            filter: [{ name: 'XML files', extensions: ['xml'] }]
        }), IPCMessages.FilePickerResponse).then((responce: IPCMessages.FilePickerResponse) => {
            if (typeof responce.error === 'string') {
                return this._notifications.add({
                    caption: `Fail open`,
                    message: `Fail to pickup file due error: ${responce.error}`,
                    options: {
                        type: ENotificationType.error,
                    }
                });
            }
            if (responce.files.length !== 1) {
                return;
            }
            this._ng_fibexFile = responce.files[0];
            this._forceUpdate();
        }).catch((error: Error) => {
            this._notifications.add({
                caption: `Fail open`,
                message: `Fail to pickup file due error: ${error.message}`,
                options: {
                    type: ENotificationType.error,
                }
            });
        });
    }

    public _ng_onKeyUpFilterInput(event: KeyboardEvent) {
        this._ng_filterSubject.next(this._ng_filterValue);
    }

    private _setFilters() {
        (this._ng_filters as any) = { };
        Object.keys(this._stats).forEach((section: string, index: number) => {
            if (CStatCaptions[section] === undefined || !(this._stats[section] instanceof Array)) {
                return;
            }
            const items: IStatRow = this._stats[section].filter((item: Array<string | CommonInterfaces.DLT.LevelDistribution>) => {
                if (item.length !== 2) {
                    return false;
                }
                if (typeof item[0] !== 'string' || typeof item[1] !== 'object' || item[1] === null) {
                    return false;
                }
                return true;
            }).map((item: Array<string | CommonInterfaces.DLT.LevelDistribution>) => {
                const stats: any = { };
                CLevelOrder.map((key: string) => {
                    stats[key] = item[1][key] === undefined ? 0 : item[1][key];
                });
                stats.id = item[0];
                stats.state = true;
                return stats as IStatRow;
            });
            (this._ng_filters as any)[section] = {
                caption: CStatCaptions[section],
                stats: items,
            };
        });
        this._forceUpdate();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
