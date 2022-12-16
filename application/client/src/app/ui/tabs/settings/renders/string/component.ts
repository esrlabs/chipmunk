import { Component, ChangeDetectorRef, Input, AfterContentInit, OnDestroy } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { ISettingsEntry } from '@platform/types/settings/entry';
import { ErrorState } from './error';
import { Validator } from '../validator';

@Component({
    selector: 'app-tabs-settings-entry-string',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class SettingsEntryString extends ChangesDetector implements AfterContentInit, OnDestroy {
    @Input() public entry!: ISettingsEntry;
    @Input() public save!: (entry: ISettingsEntry) => void;

    public value: string | undefined;
    public error!: ErrorState;

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
        this.value = this.entry.value as string;
        this.error = new ErrorState(this.entry, new Validator(), () => {
            this.detectChanges();
        });
    }
}
export interface SettingsEntryString extends IlcInterface {}
