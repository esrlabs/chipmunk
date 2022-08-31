import { Component, ChangeDetectorRef, Input, AfterContentInit } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Action } from './action';

@Component({
    selector: 'app-tabs-source-actions',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class Actions extends ChangesDetector implements AfterContentInit {
    @Input() action!: Action;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.env().subscriber.register(
            this.action.subjects.get().updated.subscribe(() => {
                this.detectChanges();
            }),
        );
        this.env().subscriber.register(
            this.action.subjects.get().apply.subscribe(() => {
                this.ngOnApply();
            }),
        );
    }

    public ngOnApply(): void {
        if (this.action.disabled) {
            return;
        }
        this.action.subjects.get().applied.emit();
    }

    public ngOnCancel() {
        this.action.subjects.get().canceled.emit();
    }
}
export interface Actions extends IlcInterface {}
