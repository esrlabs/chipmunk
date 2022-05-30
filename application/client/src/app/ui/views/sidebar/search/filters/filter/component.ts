import {
    Component,
    Input,
    ChangeDetectorRef,
    AfterContentInit,
    HostBinding,
    ViewChild,
    ChangeDetectionStrategy,
} from '@angular/core';
import { FilterRequest, UpdateEvent } from '@service/session/dependencies/search/filters/request';
import { IFilterFlags } from '@platform/types/filter';

import { MatCheckboxChange } from '@angular/material/checkbox';
import { MatInput } from '@angular/material/input';
import { MatCheckbox } from '@angular/material/checkbox';
import { FilterItemDirective } from '../../directives/item.directive';
import { ProviderFilters } from '../provider';
import { Entity } from '../../providers/definitions/entity';
import { MatDragDropResetFeatureDirective } from '@ui/env/directives/material.dragdrop';
import { Ilc, IlcInterface, Declarations } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';

@Component({
    selector: 'app-sidebar-filters-filter',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
@Initial()
@Ilc()
export class Filter extends ChangesDetector implements AfterContentInit {
    @HostBinding('class.notvalid') get cssClassNotValid() {
        return !FilterRequest.isValid(this.request);
    }

    @ViewChild(MatInput) _inputRefCom!: MatInput;
    @ViewChild(MatCheckbox) _stateRefCom!: MatCheckbox;

    @Input() entity!: Entity<FilterRequest>;
    @Input() provider!: ProviderFilters;

    public flags: IFilterFlags = {
        cases: false,
        word: false,
        reg: true,
    };
    public request: string | undefined;
    public color: string | undefined;
    public background: string | undefined;
    public state: boolean = false;
    public directive: FilterItemDirective;

    constructor(
        cdRef: ChangeDetectorRef,
        directive: FilterItemDirective,
        private _accessor: MatDragDropResetFeatureDirective,
    ) {
        super(cdRef);
        this.directive = directive;
        this.directive.setResetFeatureAccessorRef(_accessor);
    }

    public ngAfterContentInit() {
        this.env().subscriber.register(
            this.provider.subjects.edit.subscribe((guid: string | undefined) => {
                if (this.entity.uuid() === guid) {
                    this.detectChanges();
                    ChangesDetector.detectChanges(this._stateRefCom);
                    if (this._inputRefCom !== undefined) {
                        this._inputRefCom.focus();
                    }
                }
            }),
        );
        this.env().subscriber.register(
            this.entity.extract().subjects.updated.subscribe((event) => {
                this.entity.set(event.filter);
                this._init();
                this.detectChanges();
                ChangesDetector.detectChanges(this._stateRefCom);
            }),
        );
        this._init();
    }

    public _ng_onStateChange(event: MatCheckboxChange) {
        this.state = event.checked;
        this.entity.extract().set().state(event.checked);
        this.detectChanges();
        ChangesDetector.detectChanges(this._stateRefCom);
    }

    public _ng_onStateClick(event: MouseEvent) {
        this.directive.ignoreMouseClick(event);
    }

    public _ng_flagsToggle(event: MouseEvent, flag: 'cases' | 'word' | 'reg') {
        this.flags[flag] = !this.flags[flag];
        this.entity.extract().set().flags(this.flags);
        event.preventDefault();
        event.stopImmediatePropagation();
    }

    public _ng_onRequestInputKeyUp(event: KeyboardEvent) {
        if (this.provider === undefined) {
            return;
        }
        switch (event.code) {
            case 'Escape':
                this.request = this.entity.extract().definition.filter.filter;
                this.provider.edit().out();
                this.detectChanges();
                ChangesDetector.detectChanges(this._stateRefCom);
                break;
            case 'Enter':
                if (this.request !== undefined && FilterRequest.isValid(this.request)) {
                    this.entity.extract().set().filter(this.request);
                } else {
                    this.request = this.entity.extract().definition.filter.filter;
                }
                this.provider.edit().out();
                this.detectChanges();
                ChangesDetector.detectChanges(this._stateRefCom);
                break;
        }
    }

    public _ng_onRequestInputBlur() {
        if (this.provider === undefined) {
            return;
        }
        this.request = this.entity.extract().definition.filter.filter;
        this.provider.edit().out();
        this.detectChanges();
        ChangesDetector.detectChanges(this._stateRefCom);
    }

    public _ng_onDoubleClick(event: MouseEvent) {
        this.provider !== undefined && this.provider.select().doubleclick(event, this.entity);
    }

    private _init() {
        const def = this.entity.extract().definition;
        this.flags = def.filter.flags;
        this.request = def.filter.filter;
        this.color = def.colors.color;
        this.background = def.colors.background;
        this.state = def.active;
    }
}
export interface Filter extends IlcInterface {}
