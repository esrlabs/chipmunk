import {
    Component,
    OnDestroy,
    ChangeDetectorRef,
    OnChanges,
    Input,
    AfterContentInit,
    SimpleChanges,
} from '@angular/core';
import { Subscription } from 'rxjs';
import {
    Entry,
    ConnectedField,
    LocalField,
    ESettingType,
} from '../../../../controller/settings/field.store';
import {
    NotificationsService,
    ENotificationType,
} from '../../../../services.injectable/injectable.service.notifications';
import { IPair } from '../../../../thirdparty/code/engine';

import * as Toolkit from 'chipmunk.client.toolkit';

interface IChange {
    target: ConnectedField<any> | LocalField<any>;
    value: any;
}

@Component({
    selector: 'app-tabs-settings-content',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class TabSettingsContentComponent implements OnDestroy, AfterContentInit, OnChanges {
    @Input() public entry!: Entry;
    @Input() public fields: Array<ConnectedField<any> | LocalField<any>> = [];
    @Input() public matches: Map<string, IPair> = new Map();
    @Input() public filter: string = '';

    private _subscriptions: { [key: string]: Toolkit.Subscription | Subscription } = {};
    private _destroyed: boolean = false;
    private _logger: Toolkit.Logger = new Toolkit.Logger('TabSettingsContentComponent');
    private _changes: Map<string, IChange> = new Map();
    private _working: boolean = false;
    private _advanced: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef, private _notifications: NotificationsService) {}

    public ngAfterContentInit() {}

    public ngOnChanges(changes: SimpleChanges) {
        /*
        if (changes.fields === undefined && changes.entry === undefined) {
            return;
        }
        */
        this._changes.clear();
    }

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        this._destroyed = true;
    }

    public _ng_hasChanges(): boolean {
        return this._changes.size > 0;
    }

    public _ng_getChangeCallback(field: ConnectedField<any> | LocalField<any>) {
        return this._onFieldChanged.bind(this, field);
    }

    public _ng_onApply() {
        if (!this._ng_hasChanges()) {
            return;
        }
        this._working = true;
        Promise.all(
            Array.from(this._changes.values()).map((change: IChange) => {
                return change.target.set(change.value);
            }),
        )
            .catch((changeErr: Error) => {
                this._notifications.add({
                    caption: 'Settings',
                    message: `Fail save settings due error: ${changeErr.message}`,
                    options: { type: ENotificationType.warning },
                });
            })
            .finally(() => {
                this._changes.clear();
                this._working = false;
                this._forceUpdate();
            });
        this._forceUpdate();
    }

    public _ng_isWorking(): boolean {
        return this._working;
    }

    public _ng_getName(field: ConnectedField<any> | LocalField<any>): string {
        const match: IPair | undefined = this.matches.get(field.getFullPath());
        if (match === undefined) {
            return field.getName();
        } else {
            return match.caption;
        }
    }

    public _ng_getDescription(field: ConnectedField<any> | LocalField<any>): string {
        const match: IPair | undefined = this.matches.get(field.getFullPath());
        if (match === undefined) {
            return field.getDesc();
        } else {
            return match.description;
        }
    }

    public _ng_getFields(): Array<ConnectedField<any> | LocalField<any>> {
        return this.fields.filter((field: ConnectedField<any> | LocalField<any>) => {
            return this._advanced ? field : field.getType() === ESettingType.standard;
        });
    }

    public _ng_hasAdvanced(): boolean {
        let has: boolean = false;
        this.fields.forEach((field: ConnectedField<any> | LocalField<any>) => {
            if (has) {
                return;
            }
            if (field.getType() === ESettingType.advanced) {
                has = true;
            }
        });
        return has;
    }

    public _ng_onAdvanced() {
        this._advanced = !this._advanced;
        this._forceUpdate();
    }

    public _ng_getAdvancedLabel(): string {
        return this._advanced ? 'Hide advanced' : 'Show advanced';
    }

    private _onFieldChanged(field: ConnectedField<any> | LocalField<any>, value: any) {
        if (field.get() !== value) {
            this._changes.set(field.getFullPath(), {
                target: field,
                value: value,
            });
        } else {
            this._changes.delete(field.getFullPath());
        }
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }
}
