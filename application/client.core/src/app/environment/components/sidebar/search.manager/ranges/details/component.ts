import { Component, OnDestroy, ChangeDetectorRef, AfterContentInit, Input, NgZone, ViewChild, OnChanges, SimpleChanges } from '@angular/core';
import { FilterRequest } from '../../../../../controller/controller.session.tab.search.filters.request';
import { MatSelectChange, MatSelect } from '@angular/material/select';
import { Subject, Observable, Subscription } from 'rxjs';
import { CColors } from '../../../../../conts/colors';
import { getContrastColor } from '../../../../../theme/colors';
import { RangeRequest } from '../../../../../controller/controller.session.tab.search.ranges.request';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { Provider } from '../../providers/provider';
import { Entity } from '../../providers/entity';

type TColorType = 'color' | 'background';

interface IColorOption {
    title: string;
    value: TColorType;
}

@Component({
    selector: 'app-sidebar-app-searchmanager-timerange-details',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppSearchManagerTimerangeDetailsComponent implements OnDestroy, AfterContentInit, OnChanges {

    @ViewChild(MatSelect) _refSelect: MatSelect;

    @Input() provider: Provider<FilterRequest>;

    public _ng_select: Observable<number[]> = new Observable();
    public _ng_edit: Observable<FilterRequest | undefined> = new Observable();
    public _ng_reorder: Subject<void> = new Subject();
    public _ng_selected: Subject<string> = new Subject();
    public _ng_requests: FilterRequest[] = [];
    public _ng_color: string;
    public _ng_background: string;
    public _ng_colorOptions: IColorOption[] = [
        { title: 'Background', value: 'background' },
        { title: 'Foregraund', value: 'color' },
    ];
    public _ng_colorType: TColorType = 'background';
    public _ng_currentColor: string;
    public _ng_colors: string[] = [];

    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef, private _zone: NgZone) {

    }

    public ngOnDestroy() {
        this._destroyed = true;
    }

    public ngAfterContentInit() {
    }

    public ngOnChanges(changes: SimpleChanges) {
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
