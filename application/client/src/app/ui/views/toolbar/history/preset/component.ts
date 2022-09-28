import { Component, Input, AfterContentInit } from '@angular/core';
import { Collections } from '@service/history/collections';
import { FilterRequest } from '@service/session/dependencies/search/filters/request';

import { Ilc, IlcInterface } from '@env/decorators/component';

@Component({
    selector: 'app-sidebar-history-preset',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class Preset implements AfterContentInit {
    @Input() public collections!: Collections;

    public filters: FilterRequest[] = [];
    public disabled: {
        filters: FilterRequest[];
    } = {
        filters: [],
    };

    public ngAfterContentInit(): void {
        this.filters = this.collections.collections.filters.as().elements();
        this.disabled.filters = this.collections.collections.disabled
            .as()
            .elements()
            .map((el) => el.as().filter())
            .filter((f) => f !== undefined) as FilterRequest[];
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
}
export interface Preset extends IlcInterface {}
