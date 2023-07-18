import { Component, ChangeDetectorRef, Input, AfterContentInit } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Observe } from '@platform/types/observe';

@Component({
    selector: 'app-tabs-observe-error-state',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class TabObserveErrorState extends ChangesDetector implements AfterContentInit {
    @Input() observe!: Observe;

    public error: string | undefined;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.env().subscriber.register(
            this.observe.subscribe(() => {
                const error = this.observe.validate();
                this.error = error instanceof Error ? error.message : undefined;
                this.detectChanges();
            }),
        );
    }
}
export interface TabObserveErrorState extends IlcInterface {}
