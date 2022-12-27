import { Component, Input, AfterContentInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { AreaState } from '../../state';
import { Observable, Subscription } from 'rxjs';
import { IComponentDesc } from '@elements/containers/dynamic/component';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { stop } from '@ui/env/dom';

@Component({
    selector: 'app-layout-toolbar-controls',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class LayoutToolbarControls implements AfterContentInit, OnDestroy {
    @Input() public state!: AreaState;
    @Input() public injection!: Observable<IComponentDesc>;

    public _ng_injection: IComponentDesc | undefined = undefined;

    private _subscriptions: { [key: string]: Subscription } = {};

    constructor(private _cdRef: ChangeDetectorRef) {}

    public ngAfterContentInit() {
        // this._subscriptions.onInjection = this.injection.subscribe(this._onInjecton.bind(this));
    }

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public _ng_onStateToggle(event: MouseEvent) {
        if (this.state.minimized) {
            this.state.maximize();
        } else {
            this.state.minimize();
        }
        stop(event);
        return false;
    }

    public _ng_onAdd(event: MouseEvent) {
        // const tabs: ITab[] | undefined = ToolbarSessionsService.getInactiveTabs();
        // if (tabs === undefined || tabs.length === 0) {
        //     return;
        // }
        // const items: Declarations.IMenuItem[] = tabs.map((tab: ITab) => {
        //     return {
        //         caption: tab.name,
        //         handler: () => {
        //             if (tab.guid === undefined) {
        //                 this.log().error(`Tab guid is undefined`);
        //                 return;
        //             }
        //             this.state.maximize();
        //             ToolbarSessionsService.addByGuid(tab.guid);
        //             ToolbarSessionsService.setActive(tab.guid, undefined, false).catch(
        //                 (error: Error) => this.log().error(error.message),
        //             );
        //         },
        //     };
        // });
        // this.ilc().services.ui.contextmenu.show({
        //     items: items,
        //     x: event.pageX,
        //     y: event.pageY,
        // });
        stop(event);
    }

    private _onInjecton(injection: IComponentDesc) {
        this._ng_injection = injection;
        this._cdRef.detectChanges();
    }
}
export interface LayoutToolbarControls extends IlcInterface {}
