import { Component, Input, OnDestroy, ChangeDetectorRef, AfterContentInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { TabTitleContentService, IIconButton } from './service';

@Component({
    selector: 'app-layout-area-primary-tab-title-controls',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class LayoutPrimiryAreaTabTitleControlsComponent implements OnDestroy, AfterContentInit {

    @Input() public service: TabTitleContentService;

    public _ng_icons: IIconButton[] = [];

    private _subscriptions: { [key: string]: Subscription } = {};
    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef) {
    }

    ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((prop: string) => {
            this._subscriptions[prop].unsubscribe();
        });
    }

    ngAfterContentInit() {
        if (this.service === undefined) {
            return;
        }
        this._subscriptions.addIconButton = this.service.getObservable().addIconButton.subscribe(this._onAddIconButton.bind(this));
        this._subscriptions.removeIconButton = this.service.getObservable().removeIconButton.subscribe(this._onRemoveIconButton.bind(this));
    }

    public _ng_onIconButtonClick(event: MouseEvent, handler: (event: MouseEvent) => void) {
        if (typeof handler !== 'function') {
            return;
        }
        handler(event);
    }

    private _onAddIconButton(button: IIconButton) {
        this._ng_icons.push(button);
        this._forceUpdate();
    }

    private _onRemoveIconButton(id: string) {
        this._ng_icons = this._ng_icons.filter((button: IIconButton) => {
            return button.id !== id;
        });
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
