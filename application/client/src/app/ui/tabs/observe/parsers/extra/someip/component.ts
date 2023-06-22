import { Component, ChangeDetectorRef, Input, AfterContentInit } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { State } from './state';
import { Observe } from '@platform/types/observe';

@Component({
    selector: 'app-el-someip-extra',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class SomeIpExtraConfiguration extends ChangesDetector implements AfterContentInit {
    @Input() observe!: Observe;

    protected state!: State;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.state = new State(this.observe);
        this.state.bind(this);
    }
}
export interface SomeIpExtraConfiguration extends IlcInterface {}
