import {
    Component,
    ChangeDetectorRef,
    Input,
    ViewEncapsulation,
    AfterContentInit,
    AfterViewInit,
    ViewChild,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Pair } from './pair';
import { State } from './state';
import { Initial } from '@env/decorators/initial';
import { MatTableDataSource, MatTable } from '@angular/material/table';
import { HiddenFilter } from '@elements/filter.hidden/module';

@Component({
    selector: 'app-elements-pairs',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None,
})
@Initial()
@Ilc()
export class ElementsPairs extends ChangesDetector implements AfterContentInit, AfterViewInit {
    @Input() public map!: Map<string, string>;
    @Input() public close!: () => void;
    @ViewChild(MatTable) table!: MatTable<Pair>;
    @ViewChild('filter') filter!: HiddenFilter;

    public data!: MatTableDataSource<Pair>;
    public columns: string[] = ['name', 'value'];
    public state!: State;

    constructor(cdRef: ChangeDetectorRef, private _sanitizer: DomSanitizer) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.state = new State(this.map);
        this.data = new MatTableDataSource<Pair>(this.state.pairs);
    }

    public ngAfterViewInit(): void {
        this.env().subscriber.register(
            this.filter.filter.subjects.get().change.subscribe((value: string) => {
                this.update(value);
            }),
        );
        this.env().subscriber.register(
            this.filter.filter.subjects.get().drop.subscribe(() => {
                this.update('');
            }),
        );
    }

    public safeHtml(html: string): SafeHtml {
        return this._sanitizer.bypassSecurityTrustHtml(html);
    }

    public pairs(): Pair[] {
        return this.state.pairs.filter((t) => !t.hidden());
    }

    protected update(filter: string) {
        this.state.filter(filter);
        this.data.data = this.state.visible();
        this.table.renderRows();
        this.detectChanges();
    }
}
export interface ElementsPairs extends IlcInterface {}
