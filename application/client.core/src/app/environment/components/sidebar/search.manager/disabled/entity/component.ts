import {
    Component,
    Input,
    OnDestroy,
    ChangeDetectorRef,
    AfterContentInit,
    ViewChild,
} from '@angular/core';
import { DisabledRequest } from '../../../../../controller/session/dependencies/search/dependencies/disabled/controller.session.tab.search.disabled.request';
import { MatCheckboxChange } from '@angular/material/checkbox';
import { MatInput } from '@angular/material/input';
import { Subscription } from 'rxjs';
import { SidebarAppSearchManagerItemDirective } from '../../directives/item.directive';
import { ProviderDisabled } from '../provider';
import { Provider } from '../../providers/provider';
import { Entity } from '../../providers/entity';
import { MatDragDropResetFeatureDirective } from '../../../../../directives/material.dragdrop.directive';

@Component({
    selector: 'app-sidebar-app-searchmanager-disabled',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class SidebarAppSearchManagerDisabledComponent implements OnDestroy, AfterContentInit {
    @ViewChild(MatInput) _inputRefCom!: MatInput;

    @Input() entity!: Entity<DisabledRequest>;
    @Input() provider!: Provider<DisabledRequest>;

    public _ng_display_name: string | undefined;
    public _ng_icon: string | undefined;
    public _ng_directive: SidebarAppSearchManagerItemDirective;

    private _subscriptions: { [key: string]: Subscription } = {};
    private _destroyed: boolean = false;

    constructor(
        private _cdRef: ChangeDetectorRef,
        private _directive: SidebarAppSearchManagerItemDirective,
        private _accessor: MatDragDropResetFeatureDirective,
    ) {
        this._ng_directive = _directive;
        this._ng_directive.setResetFeatureAccessorRef(_accessor);
    }

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public ngAfterContentInit() {
        if (this.provider !== undefined) {
            this._subscriptions.edit = this.provider
                .getObservable()
                .edit.subscribe((guid: string | undefined) => {
                    if (this.entity.getGUID() === guid) {
                        this._forceUpdate();
                        if (this._inputRefCom !== undefined) {
                            this._inputRefCom.focus();
                        }
                    }
                });
        }
        this._init();
    }

    private _init() {
        const entity = this.entity.getEntity().getEntity();
        this._ng_display_name = entity.getDisplayName();
        this._ng_icon = entity.getIcon();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }
}
