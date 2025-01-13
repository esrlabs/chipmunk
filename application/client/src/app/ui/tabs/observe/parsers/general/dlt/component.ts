import {
    Component,
    ChangeDetectorRef,
    Input,
    AfterContentInit,
    AfterViewInit,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { bytesToStr, timestampToUTC } from '@env/str';
import { State } from './state';
import { Observe } from '@platform/types/observe';

@Component({
    selector: 'app-el-dlt-general',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    standalone: false,
})
@Initial()
@Ilc()
export class DltGeneralConfiguration
    extends ChangesDetector
    implements AfterContentInit, AfterViewInit
{
    @Input() observe!: Observe;

    protected state!: State;

    public bytesToStr = bytesToStr;
    public timestampToUTC = timestampToUTC;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.state = new State(this.observe);
        this.state.bind(this);
    }

    public ngAfterViewInit(): void {
        this.state
            .load()
            .then(() => {
                this.detectChanges();
            })
            .catch((err: Error) => {
                this.log().error(`Fail to restore configuration with: ${err.message}`);
            });
    }
}
export interface DltGeneralConfiguration extends IlcInterface {}
