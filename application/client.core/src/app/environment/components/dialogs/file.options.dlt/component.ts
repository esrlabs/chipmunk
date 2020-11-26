import { Component, Input, OnDestroy, ChangeDetectorRef, AfterContentInit, ViewChildren, QueryList } from '@angular/core';
import ElectronIpcService, { IPCMessages } from '../../../services/service.electron.ipc';
import * as Toolkit from 'chipmunk.client.toolkit';
import { NotificationsService, ENotificationType } from '../../../services.injectable/injectable.service.notifications';
import TabsSessionsService from '../../../services/service.sessions.tabs';
import { CommonInterfaces } from '../../../interfaces/interface.common';
import { Subject, Observable, Subscription } from 'rxjs';
import { DialogsFileOptionsDltStatsComponent, IStatRow, IForceSortData } from './stats/component';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import ContextMenuService, { IMenuItem } from '../../../services/standalone/service.contextmenu';
import { ControllerSessionTab } from '../../../controller/controller.session.tab';
import FocusOutputService from '../../../services/service.focus.output';

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
    @Input() public options: CommonInterfaces.DLT.IDLTOptions | undefined;
    @Input() public onDone: (options: CommonInterfaces.DLT.IDLTOptions) => void;
    @Input() public onDefaultCancelAction: () => void;

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
    public _ng_fibex: IPCMessages.IFilePickerFileInfo[] = [];
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
    private _subscriptions: { [key: string]: Subscription } = {};

    constructor(private _cdRef: ChangeDetectorRef,
                private _notifications: NotificationsService) {
        this._ng_onLogLevelChange = this._ng_onLogLevelChange.bind(this);
    }

    public ngAfterContentInit() {
        this._ng_size = this.size === -1 ? '' : `${(this.size / 1024 / 1024).toFixed(2)}Mb`;
        if (this.options !== undefined && this.options.stats !== undefined) {
            this._initAsReopen();
        } else {
            this._initAsNewOpen();
        }
    }

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
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
        FocusOutputService.focus();
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
            stats: this._stats,
            fibex: { fibex_file_paths: this._ng_fibex.map((file) => {
                return file.path;
            }) },
            fibexFilesInfo: this._ng_fibex,
        });
    }

    public _ng_onCancel() {
        this.onDefaultCancelAction();
    }

    public _ng_onFibex() {
        ElectronIpcService.request(new IPCMessages.FilePickerRequest({
            filter: [{ name: 'XML files', extensions: ['xml'] }],
            multiple: true,
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
            responce.files = responce.files.filter((incomeFile: IPCMessages.IFilePickerFileInfo) => {
                let fileIsIn: boolean = false;
                this._ng_fibex.forEach((existFile: IPCMessages.IFilePickerFileInfo) => {
                    if (existFile.path === incomeFile.path) {
                        fileIsIn = true;
                    }
                });
                return !fileIsIn;
            }).map((file: IPCMessages.IFilePickerFileInfo) => {
                (file as any).viewPath = file.path.replace(file.name, '').replace(/[^\w\d\.\_\-]$/gi, '');
                return file;
            });
            this._ng_fibex.push(...responce.files);
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

    public _ng_onFibexFileDragged(event: CdkDragDrop<string[]>) {
        const target: IPCMessages.IFilePickerFileInfo = Object.assign({}, this._ng_fibex[event.previousIndex]);
        this._ng_fibex = this._ng_fibex.filter((file: IPCMessages.IFilePickerFileInfo, i: number) => {
            return i !== event.previousIndex;
        });
        this._ng_fibex.splice(event.currentIndex, 0, target);
        this._forceUpdate();
    }

    public _ng_onFibexContexMenu(event: MouseEvent, file: IPCMessages.IFilePickerFileInfo) {
        const items: IMenuItem[] = [
            {
                caption: `Remove`,
                handler: () => {
                    this._ng_fibex = this._ng_fibex.filter((item: IPCMessages.IFilePickerFileInfo) => {
                        return file.path !== item.path;
                    });
                    this._forceUpdate();
                },
            },
            {
                caption: `Remove All`,
                handler: () => {
                    this._ng_fibex = [];
                    this._forceUpdate();
                },
            }
        ];
        ContextMenuService.show({
            items: items,
            x: event.pageX,
            y: event.pageY,
        });
        event.stopImmediatePropagation();
        event.preventDefault();
    }

    private _initAsNewOpen() {
        const controller: ControllerSessionTab = TabsSessionsService.getEmpty();
        if (!(controller instanceof ControllerSessionTab)) {
            return;
        }
        const session: string = controller.getGuid();
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

    private _initAsReopen() {
        this._ng_scanning = false;
        this._stats = this.options.stats;
        this._ng_logLevelDefault = this._getEMTINLogLevel(this.options.logLevel);
        this._logLevel = this._ng_logLevelDefault;
        this._setFilters();
        if (this.options.fibexFilesInfo instanceof Array) {
            this._ng_fibex = this.options.fibexFilesInfo;
        }
        this._forceUpdate();
    }

    private _getEMTINLogLevel(level: number): EMTIN {
        let log: EMTIN = EMTIN.DLT_LOG_VERBOSE;
        Object.keys(CLogLevel).forEach((key: EMTIN) => {
            if (level === CLogLevel[key]) {
                log = key;
            }
        });
        return log;
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
                if (this.options !== undefined ) {
                    if (this.options.filters[section] instanceof Array && this.options.filters[section].indexOf(stats.id) !== -1) {
                        stats.state = true;
                    } else {
                        stats.state = false;
                    }
                } else {
                    stats.state = true;
                }
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
