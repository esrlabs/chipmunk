import { Component, ChangeDetectorRef, Input, AfterContentInit, OnDestroy } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { ISettingsEntry } from '@platform/types/settings/entry';

@Component({
    selector: 'app-tabs-settings-entry-bool',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class SettingsEntryBool extends ChangesDetector implements AfterContentInit, OnDestroy {
    @Input() public entry!: ISettingsEntry;
    @Input() public save!: (entry: ISettingsEntry) => void;

    public value: boolean | undefined;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngOnDestroy(): void {
        if (this.value === this.entry.value) {
            return;
        }
        this.entry.value = this.value;
        this.save(this.entry);
    }

    public ngAfterContentInit(): void {
        this.value = this.entry.value === undefined ? false : (this.entry.value as boolean);
    }
}
export interface SettingsEntryBool extends IlcInterface {}
