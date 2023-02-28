import {
    Component,
    ChangeDetectorRef,
    AfterViewInit,
    Input,
    AfterContentInit,
    HostListener,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { File } from '@platform/types/files';
import { IDLTOptions, EMTIN } from '@platform/types/parsers/dlt';
import { bytesToStr, timestampToUTC } from '@env/str';
import { StatEntity } from './structure/statentity';
import { TabControls } from '@service/session';
import { State } from './state';
import { LockToken } from '@platform/env/lock.token';
import { Timezone } from '@elements/timezones/timezone';
import { components } from '@env/decorators/initial';
import { Action } from '../common/actions/action';
import { AttachmentAction } from './attachments/attachment.action';
import { FtOptions } from '@platform/types/parsers/dlt';

@Component({
    selector: 'app-tabs-source-dltfile',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class TabSourceDltFile extends ChangesDetector implements AfterViewInit, AfterContentInit {
    @Input() done!: (options: IDLTOptions | undefined) => void;
    @Input() files!: File[];
    @Input() options: IDLTOptions | undefined;
    @Input() tab!: TabControls;

    @HostListener('window:keydown', ['$event'])
    handleKeyDown(event: KeyboardEvent) {
        if (this._filterLockTocken.isLocked()) {
            return;
        }
        if (this.state.filters.entities.keyboard(event)) {
            this.state.struct().filter();
            this.detectChanges();
        }
    }

    public state: State;
    public logLevels: Array<{ value: string; caption: string }> = [
        { value: EMTIN.DLT_LOG_FATAL, caption: 'Fatal' },
        { value: EMTIN.DLT_LOG_ERROR, caption: 'Error' },
        { value: EMTIN.DLT_LOG_WARN, caption: 'Warnings' },
        { value: EMTIN.DLT_LOG_INFO, caption: 'Info' },
        { value: EMTIN.DLT_LOG_DEBUG, caption: 'Debug' },
        { value: EMTIN.DLT_LOG_VERBOSE, caption: 'Verbose' },
    ];
    public attachment: AttachmentAction = new AttachmentAction(this.ilc(), this.log());
    public action: Action = new Action();

    private _filterLockTocken: LockToken = LockToken.simple(false);

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
        this.state = new State(this.ilc());
    }

    public ngAfterContentInit(): void {
        const state = this.tab.storage<State>().get();
        if (state !== undefined) {
            this.state = state;
        } else {
            this.tab.storage().set(this.state);
        }
        if (this.options !== undefined) {
            this.state.fromOptions(this.options);
        }
        this.env().subscriber.register(
            this.attachment.subjects.get().scanned.subscribe(() => {
                const options: FtOptions = { // TODO
                    filter_config: undefined,
                    with_storage_header: true,
                };
                this.attachment.doScan(this.files, options);
            }),
        );
        this.env().subscriber.register(
            this.attachment.subjects.get().extracted.subscribe(() => {
                this.ilc().services.system.bridge.folders().select()
                .then((folders) => {
                    if (folders.length === 0) {
                        return; // aborted
                    } else if (folders.length === 1) {
                        const folder = folders[0];
                        if (this.attachment.isScanned()) {
                            this.attachment.doExtract(folder);
                        } else {
                            const options: FtOptions = { // TODO
                                filter_config: undefined,
                                with_storage_header: true,
                            };
                            this.attachment.doExtractAll(this.files, folder, options);
                        } 
                    } else {
                        this.log().error(`Invalid number of folders: ${folders.length}`);
                        return;
                    }
                })              
                .catch((err: Error) => {
                    this.log().error(`Fail to select folder: ${err.message}`);
                    return;
                });
            }),
        );
        this.env().subscriber.register(
            this.action.subjects.get().applied.subscribe(() => {
                this.done(this.state.asOptions());
                this.tab.close();
            }),
        );
        this.env().subscriber.register(
            this.action.subjects.get().canceled.subscribe(() => {
                this.tab.close();
            }),
        );
    }

    public ngAfterViewInit(): void {
        if (this.state.isStatLoaded()) {
            return;
        }
        this.tab.setTitle(
            `${
                this.files.length === 1 ? this.files[0].name : `${this.files.length} DLT files`
            } (scanning)`,
        );
        this.action.setCaption('Open');
        this.ilc()
            .services.system.bridge.dlt()
            .stat(this.files.map((f) => f.filename))
            .then((stat) => {
                this.tab.setTitle(
                    this.files.length === 1 ? this.files[0].name : `${this.files.length} DLT files`,
                );
                this.state.stat = stat;
                this.state
                    .struct()
                    .build(this.options !== undefined ? this.options.filters : undefined);
                this.detectChanges();
            })
            .catch((err: Error) => {
                this.log().error(`Fail to get DLT stat info: ${err.message}`);
            });
    }

    public getFilesStat(): {
        size: string;
        name: string;
        created: string | undefined;
        changed: string | undefined;
    } {
        return {
            size: bytesToStr(
                this.files.map((f) => f.stat.size).reduce((partialSum, a) => partialSum + a, 0),
            ),
            name: this.files.length !== 1 ? `${this.files.length} files` : this.files[0].name,
            created:
                this.files.length !== 1 ? undefined : timestampToUTC(this.files[0].stat.ctimeMs),
            changed:
                this.files.length !== 1 ? undefined : timestampToUTC(this.files[0].stat.mtimeMs),
        };
    }

    public ngOnEntitySelect(_entity: StatEntity) {
        this.state.buildSummary().selected();
        this.detectChanges();
    }

    public ngOnFibexAdd() {
        this.ilc()
            .services.system.bridge.files()
            .select.custom('xml')
            .then((files: File[]) => {
                files = files.filter((added) => {
                    return (
                        this.state.fibex.find((exist) => exist.filename === added.filename) ===
                        undefined
                    );
                });
                this.state.fibex = this.state.fibex.concat(files);
            })
            .catch((err: Error) => {
                this.log().error(`Fail to open xml (fibex) file(s): ${err.message}`);
            });
    }

    public ngOnRemoveFibex(file: File) {
        this.state.fibex = this.state.fibex.filter((f) => f.filename !== file.filename);
    }

    public ngTimezoneSelect() {
        this._filterLockTocken.lock();
        if (this.state.filters.entities.drop()) {
            this.state.struct().filter();
        }
        this.ilc().services.ui.popup.open({
            component: {
                factory: components.get('app-elements-timezone-selector'),
                inputs: {
                    selected: (timezone: Timezone): void => {
                        this.state.timezone = timezone;
                    },
                },
            },
            closeOnKey: 'Escape',
            width: 350,
            closed: () => {
                this._filterLockTocken.unlock();
            },
            uuid: 'app-elements-timezone-selector',
        });
    }

    public ngContextMenu(event: MouseEvent) {
        const after = () => {
            this.state.buildSummary().selected();
            this.detectChanges();
        };
        this.ilc().emitter.ui.contextmenu.open({
            items: [
                {
                    caption: 'Select all',
                    handler: () => {
                        this.state.structure.forEach((section) => {
                            section.entities.forEach((e) => e.select());
                        });
                        after();
                    },
                },
                {
                    caption: 'Unselect all',
                    handler: () => {
                        this.state.structure.forEach((section) => {
                            section.entities.forEach((e) => e.unselect());
                        });
                        after();
                    },
                },
                {
                    caption: 'Reverse selection',
                    handler: () => {
                        this.state.structure.forEach((section) => {
                            section.entities.forEach((e) => e.toggle());
                        });
                        after();
                    },
                },
                {},
                {
                    caption: 'Select with fotal',
                    handler: () => {
                        this.state.structure.forEach((section) => {
                            section.entities.forEach((e) => {
                                e.log_fatal > 0 && e.select();
                            });
                        });
                        after();
                    },
                },
                {
                    caption: 'Select with errors',
                    handler: () => {
                        this.state.structure.forEach((section) => {
                            section.entities.forEach((e) => {
                                e.log_error > 0 && e.select();
                            });
                        });
                        after();
                    },
                },
                {
                    caption: 'Select with warnings',
                    handler: () => {
                        this.state.structure.forEach((section) => {
                            section.entities.forEach((e) => {
                                e.log_warning > 0 && e.select();
                            });
                        });
                        after();
                    },
                },
                {},
                {
                    caption: 'Unselect without fotal',
                    handler: () => {
                        this.state.structure.forEach((section) => {
                            section.entities.forEach((e) => {
                                e.log_fatal === 0 && e.unselect();
                            });
                        });
                        after();
                    },
                },
                {
                    caption: 'Unselect without errors',
                    handler: () => {
                        this.state.structure.forEach((section) => {
                            section.entities.forEach((e) => {
                                e.log_error === 0 && e.unselect();
                            });
                        });
                        after();
                    },
                },
                {
                    caption: 'Unselect without warnings',
                    handler: () => {
                        this.state.structure.forEach((section) => {
                            section.entities.forEach((e) => {
                                e.log_warning === 0 && e.unselect();
                            });
                        });
                        after();
                    },
                },
            ],
            x: event.x,
            y: event.y,
        });
    }
}
export interface TabSourceDltFile extends IlcInterface {}
