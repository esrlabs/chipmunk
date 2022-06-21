import { Component, AfterContentInit, Input } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { IDLTOptions, getLogLevelName } from '@platform/types/parsers/dlt';

@Component({
    selector: 'app-recent-file-dlt',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class RecentFileDlt implements AfterContentInit {
    @Input() public options!: IDLTOptions;

    public dlt_filters: {
        app_ids: string[];
        context_ids: string[];
        ecu_ids: string[];
    } = {
        app_ids: [],
        context_ids: [],
        ecu_ids: [],
    };

    public ngAfterContentInit(): void {
        this.dlt_filters = {
            app_ids: this.options.filters.app_ids === undefined ? [] : this.options.filters.app_ids,
            context_ids:
                this.options.filters.context_ids === undefined
                    ? []
                    : this.options.filters.context_ids,
            ecu_ids: this.options.filters.ecu_ids === undefined ? [] : this.options.filters.ecu_ids,
        };
    }

    public getLogLevelName(level: number): string {
        return getLogLevelName(level);
    }

    public getTimezone(): string {
        return this.options.tz === undefined ? 'UTC' : this.options.tz;
    }
}
export interface RecentFileDlt extends IlcInterface {}
