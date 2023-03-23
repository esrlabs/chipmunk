import { Component, ChangeDetectorRef, Input, OnDestroy, AfterViewInit } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Subject } from '@platform/env/subscription';
import { SetupBase } from '../../bases/serial/component';

@Component({
    selector: 'app-transport-serial',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class Setup extends SetupBase implements AfterViewInit, OnDestroy {
    @Input() public update?: Subject<void>;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public override ngAfterViewInit() {
        this.update !== undefined &&
            this.env().subscriber.register(
                this.update.subscribe(() => {
                    this.detectChanges();
                }),
            );
        super.ngAfterViewInit();
    }
}
export interface TransportSerial extends IlcInterface {}
