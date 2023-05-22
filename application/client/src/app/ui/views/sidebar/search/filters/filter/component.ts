import {
    Component,
    AfterContentInit,
    HostBinding,
    ViewChild,
    ChangeDetectorRef,
} from '@angular/core';
import { FilterRequest } from '@service/session/dependencies/search/filters/request';
import { MatCheckboxChange } from '@angular/material/checkbox';
import { MatInput } from '@angular/material/input';
import { MatCheckbox } from '@angular/material/checkbox';
import { ProviderFilters } from '../provider';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { State } from './state';
import { stop } from '@ui/env/dom';
import { EFlag } from '@platform/types/filter';
import { EntityItem } from '../../base/entity';

@Component({
    selector: 'app-sidebar-filters-filter',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    hostDirectives: EntityItem.HOST_DIRECTIVES,
})
@Ilc()
export class Filter extends EntityItem<ProviderFilters, FilterRequest> implements AfterContentInit {
    @HostBinding('class.notvalid') get cssClassNotValid() {
        return !FilterRequest.isValid({
            filter: this.state.filter.filter,
            flags: {
                cases: this.state.filter.flags.cases,
                word: this.state.filter.flags.word,
                reg: this.state.filter.flags.reg,
            },
        });
    }

    @ViewChild(MatInput) _inputRefCom!: MatInput;
    @ViewChild(MatCheckbox) _stateRefCom!: MatCheckbox;

    public state!: State;
    public EFlag = EFlag;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

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
                } else if (event.inner().colors) {
                    this.state.update().colors();
                } else if (event.inner().state) {
                    this.state.update().state();
                } else if (event.inner().stat) {
                    this.state.update().stat();
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

    public _ng_flagsToggle(event: MouseEvent, flag: EFlag) {
        this.state.toggleFilter(flag);
        stop(event);
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
export interface Filter extends IlcInterface {}
