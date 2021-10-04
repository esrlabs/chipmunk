import {
    Component,
    Input,
    OnDestroy,
    ChangeDetectorRef,
    AfterContentInit,
    HostBinding,
    ViewChild,
    ChangeDetectionStrategy,
} from '@angular/core';
import {
    FilterRequest,
    IFlags,
    IFilterUpdateEvent,
} from '../../../../../controller/session/dependencies/search/dependencies/filters/controller.session.tab.search.filters.request';
import { MatCheckboxChange } from '@angular/material/checkbox';
import { MatInput } from '@angular/material/input';
import { MatCheckbox } from '@angular/material/checkbox';
import { Subscription } from 'rxjs';
import { SidebarAppSearchManagerItemDirective } from '../../directives/item.directive';
import { ProviderFilters } from '../provider';
import { Provider } from '../../providers/provider';
import { Entity } from '../../providers/entity';
import { MatDragDropResetFeatureDirective } from '../../../../../directives/material.dragdrop.directive';
import { tryDetectChanges } from '../../../../../controller/helpers/angular.insides';

@Component({
    selector: 'app-sidebar-app-searchmanager-filter',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarAppSearchManagerFilterComponent implements OnDestroy, AfterContentInit {
    @HostBinding('class.notvalid') get cssClassNotValid() {
        return !FilterRequest.isValid(this._ng_request);
    }

    @ViewChild(MatInput) _inputRefCom!: MatInput;
    @ViewChild(MatCheckbox) _stateRefCom!: MatCheckbox;
    @Input() entity!: Entity<FilterRequest>;
    @Input() provider!: Provider<FilterRequest>;

    public _ng_flags: IFlags = {
        casesensitive: false,
        wholeword: false,
        regexp: true,
    };
    public _ng_request: string | undefined;
    public _ng_color: string | undefined;
    public _ng_background: string | undefined;
    public _ng_state: boolean = false;
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
        this.entity.getEntity().onUpdated(this._onRequestUpdated.bind(this));
    }

    public _ng_onStateChange(event: MatCheckboxChange) {
        this._ng_state = event.checked;
        this.entity.getEntity().setState(event.checked);
        this._forceUpdate();
    }

    public _ng_onStateClick(event: MouseEvent) {
        this._ng_directive.ignoreMouseClick(event);
    }

    public _ng_flagsToggle(event: MouseEvent, flag: 'casesensitive' | 'wholeword' | 'regexp') {
        if (this._ng_flags === undefined) {
            return;
        }
        this._ng_flags[flag] = !this._ng_flags[flag];
        this.entity.getEntity().setFlags(this._ng_flags);
        event.preventDefault();
        event.stopImmediatePropagation();
    }

    public _ng_onRequestInputKeyUp(event: KeyboardEvent) {
        if (this.provider === undefined) {
            return;
        }
        switch (event.code) {
            case 'Escape':
                this._ng_request = this.entity.getEntity().asDesc().request;
                this.provider.edit().out();
                this._forceUpdate();
                break;
            case 'Enter':
                if (this._ng_request !== undefined && FilterRequest.isValid(this._ng_request)) {
                    this.entity.getEntity().setRequest(this._ng_request);
                } else {
                    this._ng_request = this.entity.getEntity().asDesc().request;
                }
                this.provider.edit().out();
                this._forceUpdate();
                break;
        }
    }

    public _ng_onRequestInputBlur() {
        if (this.provider === undefined) {
            return;
        }
        this._ng_request = this.entity.getEntity().asDesc().request;
        this.provider.edit().out();
        this._forceUpdate();
    }

    public _ng_onDoubleClick(event: MouseEvent) {
        this.provider !== undefined && this.provider.select().doubleclick(event, this.entity);
    }

    private _init() {
        const desc = this.entity.getEntity().asDesc();
        this._ng_flags = desc.flags;
        this._ng_request = desc.request;
        this._ng_color = desc.color;
        this._ng_background = desc.background;
        this._ng_state = desc.active;
    }

    private _onRequestUpdated(event: IFilterUpdateEvent) {
        this.entity.setEntity(event.filter);
        this._init();
        this._forceUpdate();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        tryDetectChanges(this._stateRefCom);
        this._cdRef.detectChanges();
    }
}
