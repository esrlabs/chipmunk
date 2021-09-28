import { Component, Input, OnDestroy, ChangeDetectorRef, AfterContentInit } from '@angular/core';
import { Subscription, Observable } from 'rxjs';

export interface IButton {
    alias: string;
    icon: string;
    handler: (button: IButton) => void;
    disabled: boolean;
    title: string;
}

@Component({
    selector: 'app-views-search-controls',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class ViewSearchControlsComponent implements AfterContentInit, OnDestroy {
    @Input() public getButtons!: () => IButton[];
    @Input() public onUpdate!: Observable<IButton[]>;

    public _ng_buttons: IButton[] = [];
    private _subscriptions: { [key: string]: Subscription } = {};

    constructor(private _cdRef: ChangeDetectorRef) {}

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public ngAfterContentInit() {
        if (this.onUpdate === undefined || this.onUpdate === null) {
            return;
        }
        this._subscriptions.onUpdate = this.onUpdate.subscribe(this._onUpdate.bind(this));
        this._ng_buttons = this.getButtons();
    }

    public _ng_onClick(button: IButton) {
        button.handler(button);
    }

    private _onUpdate(buttons: IButton[]) {
        this._ng_buttons = buttons;
        this._cdRef.detectChanges();
    }
}
