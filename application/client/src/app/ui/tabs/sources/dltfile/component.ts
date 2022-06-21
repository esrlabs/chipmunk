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
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { ElementsTimezoneSelector } from '@ui/elements/timezones/component';
import { LockToken } from '@platform/env/lock.token';
import { Timezone } from '@ui/elements/timezones/timezone';

@Component({
    selector: 'app-tabs-source-dltfile',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class TabSourceDltFile extends ChangesDetector implements AfterViewInit, AfterContentInit {
    @Input() done!: (options: IDLTOptions | undefined) => void;
    @Input() file!: File;
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

    public size: (s: number) => string = bytesToStr;
    public datetime: (ts: number) => string = timestampToUTC;
    public state: State;
    public logLevels: Array<{ value: string; caption: string }> = [
        { value: EMTIN.DLT_LOG_FATAL, caption: 'Fatal' },
        { value: EMTIN.DLT_LOG_ERROR, caption: 'Error' },
        { value: EMTIN.DLT_LOG_WARN, caption: 'Warnings' },
        { value: EMTIN.DLT_LOG_INFO, caption: 'Info' },
        { value: EMTIN.DLT_LOG_DEBUG, caption: 'Debug' },
        { value: EMTIN.DLT_LOG_VERBOSE, caption: 'Verbose' },
    ];

    private _filterLockTocken: LockToken = LockToken.simple(false);

    constructor(cdRef: ChangeDetectorRef, private _bottomSheet: MatBottomSheet) {
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
    }

    public ngAfterViewInit(): void {
        if (this.state.isStatLoaded()) {
            return;
        }
        this.tab.setTitle(`${this.file.name} (scanning)`);
        this.ilc()
            .services.system.bridge.dlt()
            .stat(this.file.filename)
            .then((stat) => {
                this.tab.setTitle(this.file.name);
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

    public ngOnOpen() {
        this.done(this.state.asOptions());
        this.tab.close();
    }

    public ngOnClose() {
        this.tab.close();
    }

    public ngOnEntitySelect(entity: StatEntity) {
        if (this.state.selected.find((ent) => entity.equal(ent)) !== undefined) {
            return;
        }
        this.state.selected.push(entity);
        this.state.struct().remove(entity);
        this.detectChanges();
    }

    public ngOnRemoveSelection(entity: StatEntity) {
        this.state.selected = this.state.selected.filter((ent) => !entity.equal(ent));
        this.state.struct().back(entity);
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
        const bottomSheetRef = this._bottomSheet.open(ElementsTimezoneSelector, {
            data: {
                selected: (timezone: Timezone): void => {
                    this.state.timezone = timezone;
                },
            },
        });
        const subscription = bottomSheetRef.afterDismissed().subscribe(() => {
            subscription.unsubscribe();
            this._filterLockTocken.unlock();
            this.detectChanges();
        });
    }
}
export interface TabSourceDltFile extends IlcInterface {}
