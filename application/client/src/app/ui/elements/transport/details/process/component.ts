import { Component, ChangeDetectorRef, Input, AfterViewInit, OnDestroy } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Session } from '@service/session/session';
import { ProcessTransportSettings } from '@platform/types/transport/process';

@Component({
    selector: 'app-transport-process-details',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class TransportProcess extends ChangesDetector implements AfterViewInit, OnDestroy {
    @Input() public source!: ProcessTransportSettings;
    @Input() public session!: Session;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngOnDestroy(): void {
        //
    }

    public ngAfterViewInit(): void {
        //
    }
}
export interface TransportProcess extends IlcInterface {}
