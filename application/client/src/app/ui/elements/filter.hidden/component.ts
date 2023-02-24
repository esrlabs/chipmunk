import { Component, OnDestroy, ChangeDetectorRef, AfterContentInit } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Filter } from '@ui/env/entities/filter';

@Component({
    selector: 'app-filter-hidden',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class HiddenFilter extends ChangesDetector implements AfterContentInit, OnDestroy {
    public filter!: Filter;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngOnDestroy(): void {
        this.filter.destroy();
    }

    public ngAfterContentInit(): void {
        this.filter = new Filter(this.ilc()).bind();
    }
}
export interface HiddenFilter extends IlcInterface {}
