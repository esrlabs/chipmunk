import {
    Component,
    ViewChild,
    ChangeDetectorRef,
    AfterViewInit,
    AfterContentInit,
    Input,
    ChangeDetectionStrategy,
    Output,
    EventEmitter,
    OnDestroy,
    ViewEncapsulation
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Ilc, IlcInterface, Declarations } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { File } from '@platform/types/files';
import { IDLTOptions, StatisticInfo } from '@platform/types/parsers/dlt';
import { bytesToStr, timestampToUTC } from '@env/str';
import { MatSort, Sort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { StatEntity, Section } from './statentity';
import { Subscriber } from '@platform/env/subscription';
import { MatTable } from '@angular/material/table';

export const COLUMNS = {
    id: 'id',
    non_log: 'non_log',
    log_fatal: 'log_fatal',
    log_error: 'log_error',
    log_warning: 'log_warning',
    log_info: 'log_info',
    log_debug: 'log_debug',
    log_verbose: 'log_verbose',
    log_invalid: 'log_invalid',
};

@Component({
    selector: 'app-tabs-source-dltfile-structure',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None,
})
@Ilc()
export class TabSourceDltFileStructure
    extends ChangesDetector
    implements AfterContentInit, AfterViewInit, OnDestroy
{
    columns: string[] = [
        COLUMNS.id,
        COLUMNS.log_fatal,
        COLUMNS.log_error,
        COLUMNS.log_warning,
        COLUMNS.log_debug,
        COLUMNS.log_info,
        COLUMNS.log_verbose,
        COLUMNS.non_log,
    ];

    @Input() section!: Section;
    @Output() select: EventEmitter<StatEntity> = new EventEmitter();

    @ViewChild(MatSort) sort!: MatSort;
    @ViewChild(MatTable) table!: MatTable<any>;

    public data!: MatTableDataSource<StatEntity>;

    private _subscriber: Subscriber = new Subscriber();

    constructor(cdRef: ChangeDetectorRef, private _sanitizer: DomSanitizer) {
        super(cdRef);
    }

    public ngOnDestroy(): void {
        this._subscriber.unsubscribe();
    }

    public ngAfterContentInit(): void {
        this.data = new MatTableDataSource<StatEntity>(this.section.entities);
        this._subscriber.register(
            this.section.update.subscribe(() => {
                this.data.data = this.section.entities.filter((e) => !e.selected && !e.hidden);
                this.table.renderRows();
                this.detectChanges();
            }),
        );
    }

    public ngAfterViewInit(): void {
        this.data.sort = this.sort;
    }

    public ngOnSortChange() {
        this.detectChanges();
        this.table.renderRows();
    }

    public ngOnRowSelect(entity: StatEntity) {
        this.select.emit(entity);
    }

    public safeHtml(html: string): SafeHtml {
        return this._sanitizer.bypassSecurityTrustHtml(html);
    }
}
export interface TabSourceDltFileStructure extends IlcInterface {}
