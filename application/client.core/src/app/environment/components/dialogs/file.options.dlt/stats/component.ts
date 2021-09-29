import {
    Component,
    Input,
    OnDestroy,
    ChangeDetectorRef,
    AfterViewInit,
    ViewChild,
    NgZone,
} from '@angular/core';
import * as Toolkit from 'chipmunk.client.toolkit';
import * as ThemeColors from '../../../../theme/colors';
import { MatSort, Sort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { Subscription, Observable, Subject } from 'rxjs';
import ContextMenuService, { IMenuItem } from '../../../../services/standalone/service.contextmenu';

enum ELogLevel {
    non_log = 'non_log',
    log_fatal = 'log_fatal',
    log_error = 'log_error',
    log_warning = 'log_warning',
    log_info = 'log_info',
    log_debug = 'log_debug',
    log_verbose = 'log_verbose',
    log_invalid = 'log_invalid',
}

const CLevelsColors: { [key: string]: string } = {
    [ELogLevel.non_log]: ThemeColors.scheme_color_3,
    [ELogLevel.log_fatal]: ThemeColors.scheme_color_error,
    [ELogLevel.log_error]: ThemeColors.scheme_color_error,
    [ELogLevel.log_warning]: ThemeColors.scheme_color_warning,
    [ELogLevel.log_info]: ThemeColors.scheme_color_2,
    [ELogLevel.log_debug]: ThemeColors.scheme_color_2,
    [ELogLevel.log_verbose]: ThemeColors.scheme_color_3,
    [ELogLevel.log_invalid]: ThemeColors.scheme_color_warning,
};

export interface IStatRow {
    id: string;
    state: boolean;
    non_log: number;
    log_fatal: number;
    log_error: number;
    log_warning: number;
    log_info: number;
    log_debug: number;
    log_verbose: number;
    log_invalid: number;
}

export interface IForceSortData {
    parent: string;
    direction: 'asc' | 'desc' | '';
    column: string;
}

@Component({
    selector: 'app-views-dialogs-file-options-dlt-stats',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class DialogsFileOptionsDltStatsComponent implements OnDestroy, AfterViewInit {
    @Input() public id!: string;
    @Input() public caption!: string;
    @Input() public stats!: IStatRow[];
    @Input() public display!: string[];
    @Input() public filter!: Observable<string>;
    @Input() public sort!: Subject<IForceSortData>;

    @ViewChild(MatSort, { static: true }) _ng_sortDirRef!: MatSort;

    public _ng_source: MatTableDataSource<IStatRow> = new MatTableDataSource<IStatRow>([]);

    private _logger: Toolkit.Logger = new Toolkit.Logger(`DialogsFileOptionsDltStatsComponent`);
    private _guid: string = Toolkit.guid();
    private _destroyed: boolean = false;
    private _subscriptions: { [key: string]: Subscription } = {};
    private _event: IForceSortData | undefined;

    constructor(private _cdRef: ChangeDetectorRef, private _zone: NgZone) {}

    public ngAfterViewInit() {
        this._ng_source = new MatTableDataSource<IStatRow>(this.stats);
        this._ng_source.filterPredicate = (stat: IStatRow, filter: string) => {
            return stat.id.trim().toLowerCase().includes(filter);
        };
        this._ng_source.sort = this._ng_sortDirRef;
        this._subscriptions.sortChange = this._ng_sortDirRef.sortChange.subscribe(
            this._onSortChange.bind(this),
        );
        this._subscriptions.filter = this.filter.subscribe(this._onFilterChange.bind(this));
        this._subscriptions.sort = this.sort.asObservable().subscribe(this._onSortForce.bind(this));
        this._forceUpdate();
    }

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((prop: string) => {
            this._subscriptions[prop].unsubscribe();
        });
    }

    public _ng_getStatColor(alias: string, value: number): string {
        if (value === 0) {
            return ThemeColors.scheme_color_3;
        }
        return CLevelsColors[alias];
    }

    public _ng_onContexMenu(event: MouseEvent) {
        const items: IMenuItem[] = [
            {
                caption: `Select All`,
                handler: this._setStateTo.bind(this, true),
            },
            {
                caption: `Deselect All`,
                handler: this._setStateTo.bind(this, false),
            },
            {
                /* delimiter */
            },
            {
                caption: `Reverse Selection`,
                handler: this._reverseState.bind(this, true),
            },
        ];
        ContextMenuService.show({
            items: items,
            x: event.pageX,
            y: event.pageY,
        });
        event.stopImmediatePropagation();
        event.preventDefault();
    }

    public _ng_onStateChange() {
        this._forceUpdate();
    }

    public getSelected(): string[] {
        return this.stats
            .filter((stat: IStatRow) => {
                return stat.state;
            })
            .map((stat: IStatRow) => {
                return stat.id;
            });
    }

    public getUnselected(): string[] {
        return this.stats
            .filter((stat: IStatRow) => {
                return !stat.state;
            })
            .map((stat: IStatRow) => {
                return stat.id;
            });
    }

    public getId(): string {
        return this.id;
    }

    private _onSortForce(event: IForceSortData) {
        if (this._guid === event.parent) {
            return;
        }
        if (event.direction === 'asc' || event.direction === 'desc') {
            this._event = event;
            this._ng_source.sort !== null &&
                this._ng_source.sort.sort({
                    disableClear: true,
                    id: event.column,
                    start: event.direction,
                });
        } else {
        }
        this._forceUpdate();
    }

    private _onFilterChange(filter: string) {
        this._zone.run(() => {
            this._ng_source.filter = filter.trim().toLowerCase();
            this._forceUpdate();
        });
    }

    private _setStateTo(value: boolean) {
        this._ng_source.data = this._ng_source.data.map((stat: IStatRow) => {
            stat.state = value;
            return stat;
        });
        this._forceUpdate();
    }

    private _reverseState() {
        this._ng_source.data = this._ng_source.data.map((stat: IStatRow) => {
            stat.state = !stat.state;
            return stat;
        });
        this._forceUpdate();
    }

    private _onSortChange(event: Sort) {
        if (
            this._event !== undefined &&
            this._event.column === event.active &&
            this._event.direction === event.direction
        ) {
            this._event = undefined;
            return;
        }
        this.sort.next({
            parent: this._guid,
            column: event.active,
            direction: event.direction,
        });
        this._forceUpdate();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }
}
