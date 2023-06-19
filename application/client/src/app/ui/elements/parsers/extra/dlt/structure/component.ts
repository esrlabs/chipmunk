import {
    Component,
    ViewChild,
    ChangeDetectorRef,
    AfterViewInit,
    AfterContentInit,
    Input,
    Output,
    EventEmitter,
    ViewEncapsulation,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { StatEntity } from './statentity';
import { Section } from './section';
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
    selector: 'app-el-dlt-extra-structure',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None,
})
@Ilc()
export class DltExtraConfigurationStructure
    extends ChangesDetector
    implements AfterContentInit, AfterViewInit
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

    constructor(cdRef: ChangeDetectorRef, private _sanitizer: DomSanitizer) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.data = new MatTableDataSource<StatEntity>(this.section.entities);
        this.env().subscriber.register(
            this.section.update.subscribe(() => {
                this.data.data = this.section.entities.filter((e: StatEntity) => !e.hidden());
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
        entity.toggle();
        this.select.emit(entity);
        this.detectChanges();
    }

    public safeHtml(html: string): SafeHtml {
        return this._sanitizer.bypassSecurityTrustHtml(html);
    }
}
export interface DltExtraConfigurationStructure extends IlcInterface {}
