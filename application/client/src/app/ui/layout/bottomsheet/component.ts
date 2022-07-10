import {
    Component,
    ChangeDetectorRef,
    AfterContentInit,
    ChangeDetectionStrategy,
    NgZone,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { MatBottomSheet, MatBottomSheetRef } from '@angular/material/bottom-sheet';

@Component({
    selector: 'app-layout-bottomsheet',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
@Ilc()
export class LayoutBottomSheet extends ChangesDetector implements AfterContentInit {
    private readonly _refs: Map<string, MatBottomSheetRef<unknown, any>> = new Map();

    constructor(
        cdRef: ChangeDetectorRef,
        private _bottomSheet: MatBottomSheet,
        private _zone: NgZone,
    ) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.env().subscriber.register(
            this.ilc().services.ui.bottomsheet.open.subscribe((comp) => {
                this._zone.run(() => {
                    this._bottomSheet.dismiss();
                    const bottomSheetRef = this._bottomSheet.open<unknown, unknown>(
                        comp.component as any,
                        {
                            data: comp.data,
                            hasBackdrop: true,
                        },
                    );
                    const subscription = bottomSheetRef.afterDismissed().subscribe(() => {
                        this._refs.delete(comp.uuid);
                        subscription.unsubscribe();
                        this.detectChanges();
                        if (comp.options !== undefined && comp.options.closed !== undefined) {
                            comp.options.closed();
                        }
                    });
                    bottomSheetRef.afterOpened().subscribe(() => {
                        this.detectChanges();
                    });
                    if (comp.options !== undefined) {
                        if (comp.options.position === 'top') {
                            (bottomSheetRef as any)._overlayRef._config.positionStrategy.top();
                            console.log(bottomSheetRef.containerInstance);
                        }
                    }
                    this._refs.set(comp.uuid, bottomSheetRef);
                    this.detectChanges();
                });
            }),
        );
        this.env().subscriber.register(
            this.ilc().services.ui.bottomsheet.close.subscribe((uuid) => {
                const bottomSheetRef = this._refs.get(uuid);
                if (bottomSheetRef === undefined) {
                    return;
                }
                bottomSheetRef.dismiss();
            }),
        );
    }
}
export interface LayoutBottomSheet extends IlcInterface {}
