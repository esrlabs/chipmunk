import {
    Component,
    ChangeDetectorRef,
    AfterContentInit,
    Input,
    ChangeDetectionStrategy,
} from '@angular/core';
import { ProviderCharts } from '../provider';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { State } from './state';

@Component({
    selector: 'app-sidebar-charts-details',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
@Initial()
@Ilc()
export class ChartDetails extends ChangesDetector implements AfterContentInit {
    @Input() provider!: ProviderCharts;

    public state: State;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
        this.state = new State(cdRef);
    }

    public ngAfterContentInit() {
        this.state.init(this.env(), this.provider);
    }
}
export interface ChartDetails extends IlcInterface {}
