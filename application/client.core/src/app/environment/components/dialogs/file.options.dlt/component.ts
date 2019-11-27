import { Component, Input, OnDestroy, ChangeDetectorRef, AfterContentInit } from '@angular/core';
import ElectronIpcService, { IPCMessages } from '../../../services/service.electron.ipc';
import * as Toolkit from 'chipmunk.client.toolkit';
import { NotificationsService, ENotificationType } from '../../../services.injectable/injectable.service.notifications';
import * as ThemeColors from '../../../theme/colors';
import TabsSessionsService from '../../../services/service.sessions.tabs';
import { DLT } from '../../../../../../../apps/indexer-neon/dist/index';

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

export interface IDLTFilters {
    [key: string]: string[];
}

export interface IDLTOptions {
    logLevel: number;
    filters: IDLTFilters;
    fibexFilePath?: string;
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

const CLevelsColors = {
    [CLevels.non_log]: ThemeColors.scheme_color_3,
    [CLevels.log_fatal]: ThemeColors.scheme_color_error,
    [CLevels.log_error]: ThemeColors.scheme_color_error,
    [CLevels.log_warning]: ThemeColors.scheme_color_warning,
    [CLevels.log_debug]: ThemeColors.scheme_color_2,
    [CLevels.log_verbose]: ThemeColors.scheme_color_3,
    [CLevels.log_invalid]: ThemeColors.scheme_color_warning,
};

const CLevelCaptions = {
    [CLevels.non_log]: { short: 'n/d', full: 'No Data' },
    [CLevels.log_fatal]: { short: 'FATAL', full: 'FATAL' },
    [CLevels.log_error]: { short: 'ERR', full: 'ERROR' },
    [CLevels.log_warning]: { short: 'WARN', full: 'WARNING' },
    [CLevels.log_info]: { short: 'INFO', full: 'INFO' },
    [CLevels.log_debug]: { short: 'DEBUG', full: 'DEBUG' },
    [CLevels.log_verbose]: { short: 'VERBOSE', full: 'VERBOSE' },
    [CLevels.log_invalid]: { short: 'invalid', full: 'invalid value' },
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

@Component({
    selector: 'app-views-dialogs-file-options-dlt',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class DialogsFileOptionsDltComponent implements OnDestroy, AfterContentInit {

    @Input() public fullFileName: string = '';
    @Input() public fileName: string = '';
    @Input() public size: number = -1;
    @Input() public onDone: (options: IDLTOptions) => void;
    @Input() public onCancel: () => void;

    public _ng_size: string = '';
    public _ng_logLevelDefault: EMTIN = EMTIN.DLT_LOG_VERBOSE;
    public _ng_scanning: boolean = true;
    public _ng_more: boolean = false;
    public _ng_sortByLogLevel: number = -1;
    public _ng_logLevels: Array<{ value: string; caption: string}> = [
        { value: EMTIN.DLT_LOG_FATAL, caption: 'Fatal' },
        { value: EMTIN.DLT_LOG_ERROR, caption: 'Error' },
        { value: EMTIN.DLT_LOG_WARN, caption: 'Warnings' },
        { value: EMTIN.DLT_LOG_INFO, caption: 'Info' },
        { value: EMTIN.DLT_LOG_DEBUG, caption: 'Debug' },
        { value: EMTIN.DLT_LOG_VERBOSE, caption: 'Verbose' },
    ];
    public _ng_filters: { [key: string]: {
        caption: string,
        items: Array<{ name: string, state: boolean, stats: number[] }>
     } } | undefined = undefined;
    public _ng_headers: Array<{ short: string, full: string }> = [];
    public _ng_fibexFile: IPCMessages.IFilePickerFileInfo | undefined;
    public _ng_error: string | undefined;

    private _logLevel: EMTIN = EMTIN.DLT_LOG_VERBOSE;
    private _stats: DLT.StatisticInfo | undefined;
    private _destroyed: boolean = false;
    private _requestId: string | undefined;
    private _logger: Toolkit.Logger = new Toolkit.Logger(`DialogsFileOptionsDltComponent`);

    constructor(private _cdRef: ChangeDetectorRef,
                private _notifications: NotificationsService) {
        this._ng_onLogLevelChange = this._ng_onLogLevelChange.bind(this);
    }

    public ngAfterContentInit() {
        this._ng_size = `${(this.size / 1024 / 1024).toFixed(2)}Mb`;
        this._ng_headers = CLevelOrder.map((key: string) => {
            return CLevelCaptions[key];
        });
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

    public _ng_onFilters() {
        this._ng_more = !this._ng_more;
        this._forceUpdate();
    }

    public _ng_onOpen() {
        const filters: IDLTFilters = {};
        if (this._ng_filters !== undefined) {
            Object.keys(this._ng_filters).forEach((key: string) => {
                filters[key] = this._ng_filters[key].items.filter((item) => item.state).map((item) => {
                    return item.name;
                });
            });
        }
        this.onDone({
            logLevel: CLogLevel[this._logLevel],
            filters: filters,
            fibexFilePath: this._ng_fibexFile === undefined ? undefined : this._ng_fibexFile.path,
        });
    }

    public _ng_onCancel() {
        this.onCancel();
    }

    public _ng_onChangeFilter(filter: string, index: number) {
        this._ng_filters[filter].items[index].state = !this._ng_filters[filter].items[index].state;
        this._forceUpdate();
    }

    public _ng_onSelect(filter: string) {
        this._ng_filters[filter].items = this._ng_filters[filter].items.map((item) => {
            item.state = true;
            return item;
        });
        this._forceUpdate();
    }

    public _ng_onUnselect(filter: string) {
        this._ng_filters[filter].items = this._ng_filters[filter].items.map((item) => {
            item.state = false;
            return item;
        });
        this._forceUpdate();
    }

    public _ng_onReverse(filter: string) {
        this._ng_filters[filter].items = this._ng_filters[filter].items.map((item) => {
            item.state = !item.state;
            return item;
        });
        this._forceUpdate();
    }

    public _ng_getStatColor(index: number, value: number): string {
        if (value === 0) {
            return ThemeColors.scheme_color_3;
        }
        return CLevelsColors[CLevelOrder[index]];
    }

    public _ng_onSortClick(index: number) {
        if (index === this._ng_sortByLogLevel || index === -1) {
            this._ng_sortByLogLevel = -1;
        } else {
            this._ng_sortByLogLevel = index;
        }
        this._setFilters();
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

    private _getEntityKeyByIndex(index: number): string | undefined {
        return CLevelOrder[index];
    }

    private _setFilters() {
        this._ng_filters = {};
        Object.keys(this._stats).forEach((section: string) => {
            if (CStatCaptions[section] === undefined || !(this._stats[section] instanceof Array)) {
                return;
            }
            let items = this._stats[section].filter((item: Array<string | DLT.LevelDistribution>) => {
                if (item.length !== 2) {
                    return false;
                }
                if (typeof item[0] !== 'string' || typeof item[1] !== 'object' || item[1] === null) {
                    return false;
                }
                return true;
            }).sort((a: Array<string | DLT.LevelDistribution>, b: Array<string | DLT.LevelDistribution>) => {
                return a[0] > b[0] ? 1 : -1;
            });
            if (this._ng_sortByLogLevel !== -1 && this._getEntityKeyByIndex(this._ng_sortByLogLevel) !== undefined) {
                const key: string = this._getEntityKeyByIndex(this._ng_sortByLogLevel);
                items = items.sort((a: Array<string | DLT.LevelDistribution>, b: Array<string | DLT.LevelDistribution>) => {
                    return a[1][key] < b[1][key] ? 1 : -1;
                });
            }
            items = items.map((item: Array<string | DLT.LevelDistribution>) => {
                const stats: number[] = CLevelOrder.map((key: string) => {
                    return item[1][key] === undefined ? 0 : item[1][key];
                });
                return { name: item[0], state: true, stats: stats };
            });
            this._ng_filters[section] = {
                caption: CStatCaptions[section],
                items: items,
            };
        });
        if (Object.keys(this._ng_filters).length === 0) {
            this._ng_filters = undefined;
        }
        this._forceUpdate();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
