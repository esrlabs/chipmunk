import { Component, Input } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { IDLTOptions, getLogLevelName } from '@platform/types/parsers/dlt';

@Component({
    selector: 'app-recent-stream-dlt',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class DLTStream {
    @Input() public options!: IDLTOptions;

    public getLogLevelName(level: number): string {
        return getLogLevelName(level);
    }

    public getTimezone(): string {
        return this.options.tz === undefined ? 'UTC' : this.options.tz;
    }
}
export interface DLTStream extends IlcInterface {}
