import { Component, AfterContentInit, HostBinding, ViewChild } from '@angular/core';
import { ChartRequest } from '@service/session/dependencies/search/charts/request';
import { MatCheckboxChange } from '@angular/material/checkbox';
import { MatInput } from '@angular/material/input';
import { MatCheckbox } from '@angular/material/checkbox';
import { ProviderCharts } from '../provider';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { State } from './state';
import { EFlag } from '@platform/types/filter';
import { EntityItem } from '../../base/entity';

@Component({
    selector: 'app-sidebar-charts-filter',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    hostDirectives: EntityItem.HOST_DIRECTIVES,
})
@Ilc()
export class Chart extends EntityItem<ProviderCharts, ChartRequest> implements AfterContentInit {
    @HostBinding('class.notvalid') get cssClassNotValid() {
        return !ChartRequest.isValid(this.state.filter);
    }

    @ViewChild(MatInput) _inputRefCom!: MatInput;
    @ViewChild(MatCheckbox) _stateRefCom!: MatCheckbox;

    public state!: State;
    public EFlag = EFlag;

    public ngAfterContentInit() {
        this.env().subscriber.register(
            this.provider.subjects.get().edit.subscribe((guid: string | undefined) => {
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
