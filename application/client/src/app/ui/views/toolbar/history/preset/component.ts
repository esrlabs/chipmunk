import { Component, Input, AfterContentInit, ChangeDetectorRef } from '@angular/core';
import { Collections } from '@service/history/collections';
import { FilterRequest } from '@service/session/dependencies/search/filters/request';
import { ChartRequest } from '@service/session/dependencies/search/charts/request';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';

@Component({
    selector: 'app-toolbar-history-preset',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class Preset extends ChangesDetector implements AfterContentInit {
    @Input() public collections!: Collections;

    public filters: FilterRequest[] = [];
    public charts: ChartRequest[] = [];
    public disabled: {
        filters: FilterRequest[];
        charts: ChartRequest[];
    } = {
        filters: [],
        charts: [],
    };

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.filters = this.collections.collections.filters.as().elements();
        this.charts = this.collections.collections.charts.as().elements();
        this.disabled.filters = this.collections.collections.disabled
            .as()
            .elements()
            .map((el) => el.as().filter())
            .filter((f) => f !== undefined) as FilterRequest[];
        this.disabled.charts = this.collections.collections.disabled
            .as()
            .elements()
            .map((el) => el.as().chart())
            .filter((f) => f !== undefined) as ChartRequest[];
    }

    public getName(): string {
        if (this.collections.name === '-') {
            return `${new Date(this.collections.last).toLocaleDateString('en-US')} (${
                this.collections.used
            })`;
        } else {
            return `${this.collections.name}(${this.collections.used})`;
        }
    }

    public getValue(): string {
        return this.collections.name === '-' ? '' : this.collections.name;
    }

    public onRename(value: string) {
        if (value.trim() === '') {
            this.collections.name = '-';
        } else {
            this.collections.name = value;
        }
        this.collections.setName(this.collections.name);
        this.detectChanges();
    }
}
export interface Preset extends IlcInterface {}
