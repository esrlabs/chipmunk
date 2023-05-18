import {
    Component,
    Input,
    ChangeDetectorRef,
    AfterContentInit,
    HostBinding,
    ViewChild,
    ChangeDetectionStrategy,
} from '@angular/core';
import { ChartRequest } from '@service/session/dependencies/search/charts/request';
import { MatCheckboxChange } from '@angular/material/checkbox';
import { MatInput } from '@angular/material/input';
import { MatCheckbox } from '@angular/material/checkbox';
import { FilterItemDirective } from '../../directives/item.directive';
import { ProviderCharts } from '../provider';
import { Entity } from '../../providers/definitions/entity';
import { MatDragDropResetFeatureDirective } from '@ui/env/directives/material.dragdrop';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { State } from './state';
import { EFlag } from '@platform/types/filter';

@Component({
    selector: 'app-sidebar-charts-filter',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
@Ilc()
export class Chart extends ChangesDetector implements AfterContentInit {
    @HostBinding('class.notvalid') get cssClassNotValid() {
        return true;
        // return !ChartRequest.isValid({
        //     filter: this.state.filter.filter,
        //     flags: {
        //         cases: this.state.filter.flags.cases,
        //         word: this.state.filter.flags.word,
        //         reg: this.state.filter.flags.reg,
        //     },
        // });
    }

    @ViewChild(MatInput) _inputRefCom!: MatInput;
    @ViewChild(MatCheckbox) _stateRefCom!: MatCheckbox;

    @Input() entity!: Entity<ChartRequest>;
    @Input() provider!: ProviderCharts;

    public state!: State;
    public directive: FilterItemDirective;
    public EFlag = EFlag;

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
        this.env().subscriber.register(
            this.provider.subjects.edit.subscribe((guid: string | undefined) => {
                if (this.entity.uuid() === guid) {
                    this.update();
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
                } else if (event.inner().color) {
                    this.state.update().color();
                } else if (event.inner().line) {
                    this.state.update().line();
                } else if (event.inner().point) {
                    this.state.update().point();
                } else if (event.inner().state) {
                    this.state.update().state();
                }
                this.update();
            }),
        );
        this.state = new State(this.entity, this.provider);
    }

    public _ng_onStateChange(event: MatCheckboxChange) {
        this.state.setState(event.checked);
        this.update();
    }

    public _ng_onStateClick() {
        this.directive.ignoreMouseClick();
    }

    public _ng_onRequestInputKeyUp(event: KeyboardEvent) {
        if (this.provider === undefined) {
            return;
        }
        if (['Escape', 'Enter'].indexOf(event.code) === -1) {
            return;
        }
        switch (event.code) {
            case 'Escape':
                this.state.edit().drop();
                break;
            case 'Enter':
                this.state.edit().accept();
                break;
        }
        this.update();
    }

    public _ng_onRequestInputBlur() {
        if (this.provider === undefined) {
            return;
        }
        this.state.edit().drop();
        this.update();
    }

    public _ng_onDoubleClick(event: MouseEvent) {
        this.provider !== undefined && this.provider.select().doubleclick(event, this.entity);
    }

    public update() {
        this.detectChanges();
        ChangesDetector.detectChanges(this._stateRefCom);
    }
}
export interface Chart extends IlcInterface {}
