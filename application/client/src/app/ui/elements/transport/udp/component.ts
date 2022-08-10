import { Component, ChangeDetectorRef, Input, OnDestroy } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { State } from './state';
import { Action } from '@ui/tabs/sources/common/stream.open/action';

@Component({
    selector: 'app-transport-udp',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class TransportUdp extends ChangesDetector implements OnDestroy {
    @Input() public state!: State;
    @Input() public action!: Action;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngOnDestroy(): void {
        this.state.destroy();
    }

    public ngAddMulticast() {
        this.state.addMulticast();
    }

    public ngOnRemoveMulticast() {
        this.state.cleanMulticast();
    }
}
export interface TransportUdp extends IlcInterface {}
