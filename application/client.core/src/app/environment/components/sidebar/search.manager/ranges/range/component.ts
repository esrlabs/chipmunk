import {
    Component,
    Input,
    OnDestroy,
    ChangeDetectorRef,
    AfterContentInit,
    HostBinding,
    ViewChild,
} from '@angular/core';
import {
    RangeRequest,
    IRangeUpdateEvent,
} from '../../../../../controller/session/dependencies/search/dependencies/timeranges/controller.session.tab.search.ranges.request';
import { MatInput } from '@angular/material/input';
import { Subscription } from 'rxjs';
import { SidebarAppSearchManagerItemDirective } from '../../directives/item.directive';
import { ProviderRanges } from '../provider';
import { Provider } from '../../providers/provider';
import { Entity } from '../../providers/entity';
import { MatDragDropResetFeatureDirective } from '../../../../../directives/material.dragdrop.directive';

@Component({
    selector: 'app-sidebar-app-searchmanager-timerangehook',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class SidebarAppSearchManagerTimeRangeComponent implements OnDestroy, AfterContentInit {
    @HostBinding('class.notvalid') get cssClassNotValid() {
        return this._ng_alias === undefined ? false : !RangeRequest.isValidAlias(this._ng_alias);
    }

    @ViewChild(MatInput) _inputRefCom!: MatInput;

    @Input() entity!: Entity<RangeRequest>;
    @Input() provider!: Provider<RangeRequest>;

    public _ng_alias: string | undefined;
    public _ng_color: string | undefined;
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
        this._init();
        this.entity.getEntity().onUpdated(this._onRequestUpdated.bind(this));
    }

    public _ng_onStateClick(event: MouseEvent) {
        this._ng_directive.ignoreMouseClick(event);
    }

    public _ng_onRequestInputKeyUp(event: KeyboardEvent) {
        switch (event.code) {
            case 'Escape':
                this._ng_alias = this.entity.getEntity().asDesc().alias;
                this.provider.edit().out();
                this._forceUpdate();
                break;
            case 'Enter':
                if (this._ng_alias === undefined) {
                    break;
                }
                if (RangeRequest.isValidAlias(this._ng_alias)) {
                    this.entity.getEntity().setAlias(this._ng_alias);
                } else {
                    this._ng_alias = this.entity.getEntity().asDesc().alias;
                }
                this.provider.edit().out();
                this._forceUpdate();
                break;
        }
    }

    public _ng_onRequestInputBlur() {
        this._ng_alias = this.entity.getEntity().asDesc().alias;
        this.provider.edit().out();
        this._forceUpdate();
    }

    private _onRequestUpdated(event: IRangeUpdateEvent) {
        this.entity.setEntity(event.range);
        this._init();
        this._forceUpdate();
    }

    private _init() {
        const desc = this.entity.getEntity().asDesc();
        this._ng_alias = desc.alias;
        this._ng_color = desc.color;
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }
}
