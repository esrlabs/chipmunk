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
import { DictionaryEntities } from './statentity';
import { Section } from './section';
import { MatTable } from '@angular/material/table';

@Component({
    selector: 'app-settings-scheme-nested-dictionary-structure',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None,
    standalone: false,
})
@Ilc()
export class NestedDictionaryStructure
    extends ChangesDetector
    implements AfterContentInit, AfterViewInit
{
    @Input() section!: Section;

    @Output() select: EventEmitter<DictionaryEntities> = new EventEmitter();

    @ViewChild(MatSort) sort!: MatSort;
    @ViewChild(MatTable) table!: MatTable<any>;

    public data!: MatTableDataSource<DictionaryEntities>;
    public keys: string[] = [];
    public columns: string[] = [];

    constructor(cdRef: ChangeDetectorRef, private _sanitizer: DomSanitizer) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.data = new MatTableDataSource<DictionaryEntities>(this.section.entities);
        this.keys = this.section.keys();
        this.columns = this.section.keys().concat(['id']);
        this.env().subscriber.register(
            this.section.update.subscribe(() => {
                this.data.data = this.section.entities.filter(
                    (e: DictionaryEntities) => !e.hidden(),
                );
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

    public ngOnRowSelect(entity: DictionaryEntities) {
        entity.toggle();
        this.select.emit(entity);
        this.detectChanges();
    }

    public safeHtml(html: string): SafeHtml {
        return this._sanitizer.bypassSecurityTrustHtml(html);
    }
}
export interface NestedDictionaryStructure extends IlcInterface {}
