import { Component, ChangeDetectorRef, Input, AfterContentInit } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { File } from '@platform/types/files';
import { IDLTOptions, EMTIN } from '@platform/types/parsers/dlt';
import { bytesToStr, timestampToUTC } from '@env/str';
import { TabControls } from '@service/session';
import { State, ConnectionType } from './state';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { ElementsTimezoneSelector } from '@ui/elements/timezones/component';
import { LockToken } from '@platform/env/lock.token';
import { Timezone } from '@ui/elements/timezones/timezone';
import { SourceDefinition } from '@platform/types/transport';

@Component({
    selector: 'app-tabs-source-dltnet',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class TabSourceDltNet extends ChangesDetector implements AfterContentInit {
    public readonly ConnectionType = ConnectionType;

    @Input() done!: (options: { source: SourceDefinition; options: IDLTOptions }) => void;
    @Input() file!: File;
    @Input() tab!: TabControls;
    @Input() options: { source: SourceDefinition; options: IDLTOptions } | undefined;

    public size: (s: number) => string = bytesToStr;
    public datetime: (ts: number) => string = timestampToUTC;
    public state: State = new State();
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

    public ngOnConnect() {
        this.done(this.state.asOptions());
        this.tab.close();
    }

    public ngOnClose() {
        this.tab.close();
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
export interface TabSourceDltNet extends IlcInterface {}
