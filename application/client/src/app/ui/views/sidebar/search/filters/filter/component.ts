import {
    Component,
    Input,
    ChangeDetectorRef,
    AfterContentInit,
    OnDestroy,
    ViewChild,
    ChangeDetectionStrategy,
} from '@angular/core';
import { FilterRequest } from '@service/session/dependencies/search/filters/request';
import { MatInput } from '@angular/material/input';
import { MatCheckbox } from '@angular/material/checkbox';
import { FilterItemDirective } from '../../directives/item.directive';
import { ProviderFilters } from '../provider';
import { Entity } from '../../providers/definitions/entity';
import { MatDragDropResetFeatureDirective } from '@ui/env/directives/material.dragdrop';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { State } from './state';

@Component({
    selector: 'app-sidebar-filters-filter',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
@Ilc()
export class Filter extends ChangesDetector implements AfterContentInit, OnDestroy {
    @ViewChild(MatInput) _inputRefCom!: MatInput;
    @ViewChild(MatCheckbox) _stateRefCom!: MatCheckbox;

    @Input() entity!: Entity<FilterRequest>;
    @Input() provider!: ProviderFilters;

    public state!: State;
    public directive: FilterItemDirective;

    constructor(
        cdRef: ChangeDetectorRef,
        directive: FilterItemDirective,
        accessor: MatDragDropResetFeatureDirective,
    ) {
        super(cdRef);
        this.directive = directive;
        this.directive.setResetFeatureAccessorRef(accessor);
    }

    public ngAfterContentInit() {
        this.state = new State(this.entity, this.provider);
        this.env().subscriber.register(
            this.provider.subjects.edit.subscribe((guid: string | undefined) => {
                if (this.entity.uuid() === guid) {
                    this._update();
                    if (this._inputRefCom !== undefined) {
                        this._inputRefCom.focus();
                    }
                }
            }),
        );
        this.env().subscriber.register(
            this.entity.extract().updated.subscribe((event) => {
                if (event.inner().filter) {
                    this.state.update().filter();
                } else if (event.inner().colors) {
                    this.state.update().colors();
                } else if (event.inner().state) {
                    this.state.update().state();
                } else if (event.inner().stat) {
                    this.state.update().stat();
                }
                this._update();
            }),
        );
        // [TODO] Check
        this.env().subscriber.register(this.state.error.updated.subscribe(() => this._update()));
    }

    public ngOnDestroy() {
        this.state.error.destroy();
    }

    public _ng_onStateClick() {
        this.directive.ignoreMouseClick();
    }

    private _update() {
        this.detectChanges();
        ChangesDetector.detectChanges(this._stateRefCom);
    }
}
export interface Filter extends IlcInterface {}
