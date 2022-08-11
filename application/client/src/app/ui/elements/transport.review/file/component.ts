import { Component, ChangeDetectorRef, Input, AfterViewInit, OnDestroy } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Session } from '@service/session/session';

@Component({
    selector: 'app-transport-file-review',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class TransportFile extends ChangesDetector implements AfterViewInit, OnDestroy {
    @Input() public source!: string;
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
export interface TransportFile extends IlcInterface {}
