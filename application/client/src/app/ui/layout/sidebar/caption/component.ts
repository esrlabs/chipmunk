import { Component, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { IComponentDesc } from '@elements/containers/dynamic/component';
import { Ilc, IlcInterface } from '@env/decorators/component';

@Component({
    selector: 'app-layout-sidebar-caption',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class LayoutSidebarCaption implements AfterViewInit {
    public _ng_injection: IComponentDesc | undefined = undefined;

    constructor(private _cdRef: ChangeDetectorRef) {}

    ngAfterViewInit() {
        // this._subscriptions.onInjectionUpdated =
        //     SidebarSessionsService.getObservable().injection.subscribe(
        //         this._onInjectionUpdated.bind(this),
        //     );
    }

    // private _onInjectionUpdated(comp: IComponentDesc | undefined) {
    //     this._ng_injection = comp;
    //     this._cdRef.detectChanges();
    // }
}
export interface LayoutSidebarCaption extends IlcInterface {}
