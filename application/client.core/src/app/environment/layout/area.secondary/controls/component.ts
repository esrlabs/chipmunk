import { Component, Input, AfterContentInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { AreaState } from '../../state';
import { Observable, Subscription } from 'rxjs';
import { IComponentDesc } from 'chipmunk-client-material';


@Component({
    selector: 'app-layout-area-secondary-controls',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class LayoutSecondaryAreaControlsComponent implements AfterContentInit, OnDestroy {

    @Input() public state: AreaState;
    @Input() public injection: Observable<IComponentDesc>;

    public _ng_injection: IComponentDesc | undefined = undefined;

    private _subscriptions: { [key: string]: Subscription } = {};

    constructor(private _cdRef: ChangeDetectorRef) {

    }

    ngAfterContentInit() {
        this._subscriptions.onInjection = this.injection.subscribe(this._onInjecton.bind(this));
    }

    ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    private _ng_onStateToggle(event: MouseEvent) {
        if (this.state.minimized) {
            this.state.maximize();
        } else {
            this.state.minimize();
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        return false;
    }

    private _onInjecton(injection: IComponentDesc) {
        this._ng_injection = injection;
        this._cdRef.detectChanges();
    }

}
