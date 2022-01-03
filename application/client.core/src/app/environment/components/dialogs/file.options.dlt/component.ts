import {
    Component,
    Input,
    OnDestroy,
    ChangeDetectorRef,
    AfterContentInit,
    ViewChildren,
    QueryList,
    ViewEncapsulation,
} from '@angular/core';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import ElectronIpcService, { IPC } from '../../../services/service.electron.ipc';
import {
    NotificationsService,
    ENotificationType,
} from '../../../services.injectable/injectable.service.notifications';
import TabsSessionsService from '../../../services/service.sessions.tabs';
import { CommonInterfaces } from '../../../interfaces/interface.common';
import { Subject, Observable, Subscription } from 'rxjs';
import { DialogsFileOptionsDltStatsComponent, IStatRow, IForceSortData } from './stats/component';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import ContextMenuService, { IMenuItem } from '../../../services/standalone/service.contextmenu';
import FocusOutputService from '../../../services/service.focus.output';
import { Session } from '../../../controller/session/session';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import * as Toolkit from 'chipmunk.client.toolkit';
import * as moment_timezone from 'moment-timezone';
import { map, startWith } from 'rxjs/operators';
import { FormControl } from '@angular/forms';

export enum EMTIN {
    // If MSTP == DLT_TYPE_LOG
    DLT_LOG_FATAL = 'DLT_LOG_FATAL',
    DLT_LOG_ERROR = 'DLT_LOG_ERROR',
    DLT_LOG_WARN = 'DLT_LOG_WARN',
    DLT_LOG_INFO = 'DLT_LOG_INFO',
    DLT_LOG_DEBUG = 'DLT_LOG_DEBUG',
    DLT_LOG_VERBOSE = 'DLT_LOG_VERBOSE',
    // If MSTP == DLT_TYPE_APP_TRACE
    DLT_TRACE_VARIABLE = 'DLT_TRACE_VARIABLE',
    DLT_TRACE_FUNCTION_IN = 'DLT_TRACE_FUNCTION_IN',
    DLT_TRACE_FUNCTION_OUT = 'DLT_TRACE_FUNCTION_OUT',
    DLT_TRACE_STATE = 'DLT_TRACE_STATE',
    DLT_TRACE_VFB = 'DLT_TRACE_VFB',
    // If MSTP == DLT_TYPE_NW_TRACE
    DLT_NW_TRACE_IPC = 'DLT_NW_TRACE_IPC',
    DLT_NW_TRACE_CAN = 'DLT_NW_TRACE_CAN',
    DLT_NW_TRACE_FLEXRAY = 'DLT_NW_TRACE_FLEXRAY',
    DLT_NW_TRACE_MOST = 'DLT_NW_TRACE_MOST',
    // If MSTP == DLT_TYPE_CONTROL
    DLT_CONTROL_REQUEST = 'DLT_CONTROL_REQUEST',
    DLT_CONTROL_RESPONSE = 'DLT_CONTROL_RESPONSE',
    DLT_CONTROL_TIME = 'DLT_CONTROL_TIME',
    // Default
    UNDEFINED = 'UNDEFINED',
}

const CLogLevel: { [key: string]: number } = {
    [EMTIN.DLT_LOG_FATAL]: 1,
    [EMTIN.DLT_LOG_ERROR]: 2,
    [EMTIN.DLT_LOG_WARN]: 3,
    [EMTIN.DLT_LOG_INFO]: 4,
    [EMTIN.DLT_LOG_DEBUG]: 5,
    [EMTIN.DLT_LOG_VERBOSE]: 6,
};

const CStatCaptions: { [key: string]: string } = {
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
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None,
})
export class DialogsFileOptionsDltComponent implements OnDestroy, AfterContentInit {
    @ViewChildren(DialogsFileOptionsDltStatsComponent)
    public _ng_sectionsRefs!: QueryList<DialogsFileOptionsDltStatsComponent>;

    @Input() public fullFileName: string = '';
    @Input() public fileName: string = '';
    @Input() public size: number = -1;
    @Input() public options: CommonInterfaces.DLT.IDLTOptions | undefined;
    @Input() public onDone!: (options: CommonInterfaces.DLT.IDLTOptions) => void;
    @Input() public onDefaultCancelAction!: () => void;

    public _ng_size: string = '';
    public _ng_scanning: boolean = true;
    public _ng_sortByLogLevel: number = -1;
    public _ng_logLevels: Array<{ value: string; caption: string }> = [
        { value: EMTIN.DLT_LOG_FATAL, caption: 'Fatal' },
        { value: EMTIN.DLT_LOG_ERROR, caption: 'Error' },
        { value: EMTIN.DLT_LOG_WARN, caption: 'Warnings' },
        { value: EMTIN.DLT_LOG_INFO, caption: 'Info' },
        { value: EMTIN.DLT_LOG_DEBUG, caption: 'Debug' },
        { value: EMTIN.DLT_LOG_VERBOSE, caption: 'Verbose' },
    ];
    public _ng_filters: IStats | undefined = undefined;
    public _ng_fibex: IPC.IFilePickerFileInfo[] = [];
    public _ng_error: string | undefined;
    public _ng_dispayed: string[] = ['id', ...CLevelOrder];
    public _ng_filterSubject: Subject<string> = new Subject<string>();
    public _ng_filterValue: string = '';
    public _ng_sortSubject: Subject<IForceSortData> = new Subject<IForceSortData>();
    public _ng_logLevel: EMTIN = EMTIN.DLT_LOG_VERBOSE;
    public _ng_filteringExpanded: boolean = true;
    public _ng_timezones!: Observable<string[]>;
    public _ng_timezoneInput = new FormControl();
    public _ng_recentTzLoading: boolean = true;

    private _timezones: { name: string; fullName: string; utcOffset: number }[] = [];
    private _stats: CommonInterfaces.DLT.StatisticInfo | undefined;
    private _destroyed: boolean = false;
    private _requestId: string | undefined;
    private _logger: Toolkit.Logger = new Toolkit.Logger(`DialogsFileOptionsDltComponent`);
    private _subscriptions: { [key: string]: Subscription } = {};

    constructor(
        private _cdRef: ChangeDetectorRef,
        private _notifications: NotificationsService,
        private _sanitizer: DomSanitizer,
    ) {}

    public ngAfterContentInit() {
        const now = new Date();
        const utc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth());
        this._timezones = moment_timezone.tz
            .names()
            .map((tzName: string) => {
                const zone = moment_timezone.tz.zone(tzName);
                if (zone === null) {
                    return undefined;
                } else {
                    const offset = zone.utcOffset(utc);
                    return {
                        name: tzName,
                        utcOffset: offset,
                        fullName: `${tzName} (${offset === 0 ? '' : offset > 0 ? '-' : '+'}${
                            Math.abs(offset) / 60
                        } UTC)`,
                    };
                }
            })
            .filter((t) => t !== undefined) as {
            name: string;
            fullName: string;
            utcOffset: number;
        }[];
        this._timezones.unshift({ name: 'UTC', utcOffset: 0, fullName: 'UTC' });
        this._ng_size = this.size === -1 ? '' : `${(this.size / 1024 / 1024).toFixed(2)}Mb`;
        if (this.options !== undefined && this.options.stats !== undefined) {
            this._initAsReopen();
        } else {
            this._initAsNewOpen();
        }
        this._ng_timezoneInput.setValue(`Loading ...`);
        this._ng_timezones = this._ng_timezoneInput.valueChanges.pipe(
            startWith(''),
            map((value: string) => this._filterTimeZones(value)),
        );
        this._getRecentTimezone();
        ElectronIpcService.request<IPC.DLTFibexLoadResponse>(
            new IPC.DLTFibexLoadRequest({
                dlt: this.fullFileName,
            }),
            IPC.DLTFibexLoadResponse,
        )
            .then((response: IPC.DLTFibexLoadResponse) => {
                this._ng_fibex = response.fibexFiles;
            })
            .catch((error: Error) => {
                this._logger.warn(`Fail to load fibex files due error: ${error.message}`);
            });
    }

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        if (this._requestId !== undefined) {
            this._logger.env(`Canceling DLT stats getting by request "${this._requestId}"`);
            ElectronIpcService.request<IPC.DLTStatsResponse>(
                new IPC.DLTStatsCancelRequest({
                    id: this._requestId,
                    session: 'none',
                }),
                IPC.DLTStatsCancelResponse,
            )
                .then((response) => {
                    this._requestId = undefined;
                    this._logger.env(`Canceled DLT stats getting`);
                })
                .catch((error: Error) => {
                    this._requestId = undefined;
                    this._logger.warn(
                        `Fail to cancel DLT stats getting due error: ${error.message}`,
                    );
                });
        }
        FocusOutputService.focus();
    }

    public _ng_onOpen() {
        const filters: CommonInterfaces.DLT.IDLTFilters = {};
        const tzIndex = this._timezones.findIndex(
            (v) => v.fullName === this._ng_timezoneInput.value,
        );
        this._ng_sectionsRefs.map((section: DialogsFileOptionsDltStatsComponent) => {
            filters[section.getId()] = section.getSelected();
        });
        this.onDone({
            logLevel: CLogLevel[this._ng_logLevel],
            filters: filters,
            stats: this._stats,
            fibex: {
                fibex_file_paths: this._ng_fibex.map((file) => {
                    return file.path;
                }),
            },
            fibexFilesInfo: this._ng_fibex,
            tz: tzIndex <= 0 ? undefined : this._timezones[tzIndex].name,
        });
        ElectronIpcService.send(
            new IPC.DLTFibexSave({
                dlt: this.fullFileName,
                fibexFiles: this._ng_fibex,
            }),
        ).catch((error: Error) => {
            this._logger.warn(`Fail to save fibex files due error: ${error.message}`);
        });
    }

    public _ng_onCancel() {
        this.onDefaultCancelAction();
    }

    public _ng_onFibex() {
        ElectronIpcService.request<IPC.FilePickerResponse>(
            new IPC.FilePickerRequest({
                filter: [{ name: 'XML files', extensions: ['xml'] }],
                multiple: true,
                defaultPath: this.fullFileName,
            }),
            IPC.FilePickerResponse,
        )
            .then((responce) => {
                if (typeof responce.error === 'string') {
                    return this._notifications.add({
                        caption: `Fail open`,
                        message: `Fail to pickup file due error: ${responce.error}`,
                        options: {
                            type: ENotificationType.error,
                        },
                    });
                }
                responce.files = responce.files
                    .filter((incomeFile: IPC.IFilePickerFileInfo) => {
                        let fileIsIn: boolean = false;
                        this._ng_fibex.forEach((existFile: IPC.IFilePickerFileInfo) => {
                            if (existFile.path === incomeFile.path) {
                                fileIsIn = true;
                            }
                        });
                        return !fileIsIn;
                    })
                    .map((file: IPC.IFilePickerFileInfo) => {
                        (file as any).viewPath = file.path
                            .replace(file.name, '')
                            .replace(/[^\w\d\.\_\-]$/gi, '');
                        return file;
                    });
                this._ng_fibex.push(...responce.files);
                this._forceUpdate();
            })
            .catch((error: Error) => {
                this._notifications.add({
                    caption: `Fail open`,
                    message: `Fail to pickup file due error: ${error.message}`,
                    options: {
                        type: ENotificationType.error,
                    },
                });
            });
    }

    public _ng_onKeyUpFilterInput(event: KeyboardEvent) {
        this._ng_filterSubject.next(this._ng_filterValue);
    }

    public _ng_onFibexFileDragged(event: CdkDragDrop<string[]>) {
        const target: IPC.IFilePickerFileInfo = Object.assign(
            {},
            this._ng_fibex[event.previousIndex],
        );
        this._ng_fibex = this._ng_fibex.filter((file: IPC.IFilePickerFileInfo, i: number) => {
            return i !== event.previousIndex;
        });
        this._ng_fibex.splice(event.currentIndex, 0, target);
        this._forceUpdate();
    }

    public _ng_onFibexContexMenu(event: MouseEvent, file: IPC.IFilePickerFileInfo) {
        const items: IMenuItem[] = [
            {
                caption: `Remove`,
                handler: () => {
                    this._ng_fibex = this._ng_fibex.filter((item: IPC.IFilePickerFileInfo) => {
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
            },
        ];
        ContextMenuService.show({
            items: items,
            x: event.pageX,
            y: event.pageY,
        });
        event.stopImmediatePropagation();
        event.preventDefault();
    }

    public _ng_getStatsSummary(): string {
        let warning: number = 0;
        let error: number = 0;
        if (this._ng_filters !== undefined) {
            this._ng_filters.app_ids.stats.forEach((stat: IStatRow) => {
                error += stat.log_error;
                warning += stat.log_warning;
            });
            this._ng_filters.context_ids.stats.forEach((stat: IStatRow) => {
                error += stat.log_error;
                warning += stat.log_warning;
            });
            this._ng_filters.ecu_ids.stats.forEach((stat: IStatRow) => {
                error += stat.log_error;
                warning += stat.log_warning;
            });
        }
        return `Error(s): ${error}\t Warning(s): ${warning}`;
    }

    public _ng_getSafeHTML(input: string): SafeHtml {
        return this._sanitizer.bypassSecurityTrustHtml(input);
    }

    public _ng_tzOnFocus() {
        if (this._ng_timezoneInput.value === this._timezones[0]) {
            this._ng_timezoneInput.setValue('');
        }
    }

    public _ng_onTzSelected(event: MatAutocompleteSelectedEvent) {
        this._ng_timezoneInput.setValue(event.option.viewValue);
    }

    private _filterTimeZones(filter: string): string[] {
        filter = filter.replace(/[^\d\w\s+-\\]/gi, '');
        const key = Toolkit.regTools.createFromStr(filter);
        if (key instanceof Error) {
            return this._timezones.map((t) => t.fullName);
        }
        return this._timezones
            .map((tz) => {
                let match: RegExpMatchArray | null = tz.fullName.match(key);
                if (match === null || match.length === 0) {
                    return undefined;
                }
                return tz.fullName.replace(match[0], `<span>${match[0]}</span>`);
            })
            .filter((tz) => tz !== undefined) as string[];
    }

    private _initAsNewOpen() {
        const controller: Session | undefined = TabsSessionsService.getEmpty();
        if (!(controller instanceof Session)) {
            return;
        }
        const session: string = controller.getGuid();
        this._requestId = Toolkit.guid();
        ElectronIpcService.request<IPC.DLTStatsResponse>(
            new IPC.DLTStatsRequest({
                file: this.fullFileName,
                id: this._requestId,
                session: 'none',
            }),
            IPC.DLTStatsResponse,
        )
            .then((response) => {
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
                        },
                    });
                    this._forceUpdate();
                    return;
                }
                this._stats = response.stats;
                this._setFilters();
            })
            .catch((error: Error) => {
                this._ng_scanning = false;
                this._ng_error = error.message;
                this._forceUpdate();
                this._notifications.add({
                    caption: `Fail to scan ${this.fileName}`,
                    message: error.message,
                    session: session,
                    options: {
                        type: ENotificationType.error,
                    },
                });
            });
    }

    private _initAsReopen() {
        this._ng_scanning = false;
        if (this.options !== undefined) {
            this._stats = this.options.stats;
            this._ng_logLevel = this._getEMTINLogLevel(this.options.logLevel);
            this._setFilters();
            if (this.options.fibexFilesInfo instanceof Array) {
                this._ng_fibex = this.options.fibexFilesInfo;
            }
        }
        this._forceUpdate();
    }

    private _getEMTINLogLevel(level: number): EMTIN {
        let log: EMTIN = EMTIN.DLT_LOG_VERBOSE;
        Object.keys(CLogLevel).forEach((key: string) => {
            if (level === CLogLevel[key]) {
                log = key as EMTIN;
            }
        });
        return log;
    }

    private _setFilters() {
        (this._ng_filters as any) = {};
        this._stats !== undefined &&
            Object.keys(this._stats).forEach((section: string, index: number) => {
                if (
                    CStatCaptions[section] === undefined ||
                    !((this._stats as any)[section] instanceof Array)
                ) {
                    return;
                }
                const items: IStatRow = (this._stats as any)[section]
                    .filter((item: Array<string | CommonInterfaces.DLT.LevelDistribution>) => {
                        if (item.length !== 2) {
                            return false;
                        }
                        if (
                            typeof item[0] !== 'string' ||
                            typeof item[1] !== 'object' ||
                            item[1] === null
                        ) {
                            return false;
                        }
                        return true;
                    })
                    .map((item: Array<string | CommonInterfaces.DLT.LevelDistribution>) => {
                        const stats: any = {};
                        CLevelOrder.map((key: string) => {
                            stats[key] =
                                (item[1] as any)[key] === undefined ? 0 : (item[1] as any)[key];
                        });
                        stats.id = item[0];
                        if (this.options !== undefined) {
                            if (
                                this.options.filters[section] instanceof Array &&
                                this.options.filters[section].indexOf(stats.id) !== -1
                            ) {
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

    private _getRecentTimezone() {
        ElectronIpcService.request<IPC.DLTRecentTimeZoneResponse>(
            new IPC.DLTRecentTimeZoneRequest(),
            IPC.DLTRecentTimeZoneResponse,
        )
            .then((response) => {
                if (response.timezone === '') {
                    this._ng_timezoneInput.setValue(this._timezones[0].fullName);
                } else {
                    const tzIndex = this._timezones.findIndex(
                        (tz) => tz.name === response.timezone,
                    );
                    if (tzIndex !== -1) {
                        this._ng_timezoneInput.setValue(this._timezones[tzIndex].fullName);
                    } else {
                        this._ng_timezoneInput.setValue(this._timezones[0].fullName);
                    }
                }
            })
            .catch((error: Error) => {
                this._ng_timezoneInput.setValue(this._timezones[0].fullName);
                this._logger.warn(
                    `Fail to get recently used timezone for DLT due error: ${error.message}`,
                );
            })
            .finally(() => {
                this._ng_recentTzLoading = false;
            });
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }
}
