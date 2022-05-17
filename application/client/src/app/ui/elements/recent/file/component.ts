import { Component, AfterContentInit, Input, HostListener } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { bytesToStr, timestampToUTC } from '@env/str';
import { Recent as RecentFileAction } from '@service/recent/implementations/file/file';
import {
    IDLTOptions,
    StatisticInfo,
    LevelDistribution,
    EMTIN,
    IDLTFilters,
    getLogLevelName,
} from '@platform/types/parsers/dlt';

import * as Files from '@service/recent/implementations/file/index';

@Component({
    selector: 'app-recent-file',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class RecentFile implements AfterContentInit {
    @Input() public text: Files.Text | undefined;
    @Input() public dlt: Files.Dlt | undefined;
    @Input() public pcap: Files.Pcap | undefined;

    public name!: string;
    public path!: string;
    public size!: string;
    public created!: string;

    public dlt_filters: {
        app_ids: string[];
        context_ids: string[];
        ecu_ids: string[];
    } = {
        app_ids: [],
        context_ids: [],
        ecu_ids: [],
    };

    @HostListener('click', [])
    onClick() {}

    public ngAfterContentInit(): void {
        const base =
            this.text !== undefined
                ? this.text
                : this.dlt !== undefined
                ? this.dlt
                : this.pcap !== undefined
                ? this.pcap
                : undefined;
        if (base === undefined) {
            throw new Error(`No file data provided`);
        }
        this.name = base.name;
        this.path = base.path;
        this.size = bytesToStr(base.size);
        this.created = timestampToUTC(base.created);
        if (this.dlt !== undefined) {
            this.dlt_filters = {
                app_ids:
                    this.dlt.options.filters.app_ids === undefined
                        ? []
                        : this.dlt.options.filters.app_ids,
                context_ids:
                    this.dlt.options.filters.context_ids === undefined
                        ? []
                        : this.dlt.options.filters.context_ids,
                ecu_ids:
                    this.dlt.options.filters.ecu_ids === undefined
                        ? []
                        : this.dlt.options.filters.ecu_ids,
            };
        }
    }

    public getLogLevelName(level: number): string {
        return getLogLevelName(level);
    }
}
export interface RecentFile extends IlcInterface {}
