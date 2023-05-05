import { Component, ChangeDetectorRef, Input, OnDestroy, AfterContentInit } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Subject } from '@platform/env/subscription';
import { SetupBase } from '../../bases/serial/component';

@Component({
    selector: 'app-transport-serial',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class Setup extends SetupBase implements AfterContentInit, OnDestroy {
    @Input() public update?: Subject<void>;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public override ngAfterContentInit() {
        this.update !== undefined &&
            this.env().subscriber.register(
                this.update.subscribe(() => {
                    this.detectChanges();
                }),
            );
        super.ngAfterContentInit();
    }
}
export interface TransportSerial extends IlcInterface {}
