import { Component, Input, AfterContentInit, ChangeDetectorRef } from '@angular/core';
import { Collections } from '@service/history/collections';
import { FilterRequest } from '@service/session/dependencies/search/filters/request';
import { ChartRequest } from '@service/session/dependencies/search/charts/request';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';

import * as dom from '@ui/env/dom';

const CUT_LIST_ON = 5;

enum Target {
    Filters,
    Charts,
    DisabledFilters,
    DisabledCharts,
}

@Component({
    selector: 'app-toolbar-history-preset',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    standalone: false,
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
    public origin: {
        filters: FilterRequest[];
        charts: ChartRequest[];
        disabled: {
            filters: FilterRequest[];
            charts: ChartRequest[];
        };
    } = {
        filters: [],
        charts: [],
        disabled: {
            filters: [],
            charts: [],
        },
    };

    public get Target(): typeof Target {
        return Target;
    }

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.origin.filters = this.collections.collections.filters.as().elements();
        this.origin.charts = this.collections.collections.charts.as().elements();
        this.origin.disabled.filters = this.collections.collections.disabled
            .as()
            .elements()
            .map((el) => el.as().filter())
            .filter((f) => f !== undefined) as FilterRequest[];
        this.origin.disabled.charts = this.collections.collections.disabled
            .as()
            .elements()
            .map((el) => el.as().chart())
            .filter((f) => f !== undefined) as ChartRequest[];
        this.filters = this.origin.filters.slice(0, CUT_LIST_ON);
        this.charts = this.origin.charts.slice(0, CUT_LIST_ON);
        this.disabled.filters = this.origin.disabled.filters.slice(0, CUT_LIST_ON);
        this.disabled.charts = this.origin.disabled.charts.slice(0, CUT_LIST_ON);
    }

    public getName(): string {
        if (this.collections.name === '-') {
            return `${new Date(this.collections.last).toLocaleDateString('en-US')} (${
                this.collections.applied_sessions.size
            })`;
        } else {
            return `${this.collections.name}(${this.collections.applied_sessions.size})`;
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

    public more(event: MouseEvent, target: Target) {
        dom.stop(event);
        if (target === Target.Filters) {
            this.filters = this.origin.filters;
        } else if (target === Target.Charts) {
            this.charts = this.origin.charts;
        } else if (target === Target.DisabledCharts) {
            this.disabled.charts = this.origin.disabled.charts;
        } else if (target === Target.DisabledFilters) {
            this.disabled.filters = this.origin.disabled.filters;
        }
        this.detectChanges();
    }
}
export interface Preset extends IlcInterface {}
