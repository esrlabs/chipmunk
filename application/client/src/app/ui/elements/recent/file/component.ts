import { Component, AfterContentInit, Input } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { bytesToStr, timestampToUTC } from '@env/str';

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
    @Input() public pcapng: Files.PcapNG | undefined;

    public name!: string;
    public path!: string;
    public size!: string;
    public created!: string;

    public ngAfterContentInit(): void {
        const base =
            this.text !== undefined
                ? this.text
                : this.dlt !== undefined
                ? this.dlt
                : this.pcapng !== undefined
                ? this.pcapng
                : undefined;
        if (base === undefined) {
            throw new Error(`No file data provided`);
        }
        this.name = base.name;
        this.path = base.path;
        this.size = bytesToStr(base.size);
        this.created = timestampToUTC(base.created);
    }
}
export interface RecentFile extends IlcInterface {}
