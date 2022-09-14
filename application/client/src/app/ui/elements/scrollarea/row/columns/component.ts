import {
    Component,
    Input,
    ChangeDetectorRef,
    AfterContentInit,
    HostBinding,
    SkipSelf,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { Row } from '@schema/content/row';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Columns as ColumnsController } from '@schema/render/columns';
import { Cell } from './cell';
import { ChangesDetector } from '@ui/env/extentions/changes';

@Component({
    selector: 'app-scrollarea-row-columns',
    styleUrls: ['./styles.less'],
    templateUrl: './template.html',
})
@Ilc()
export class Columns extends ChangesDetector implements AfterContentInit {
    @Input() public row!: Row;

    public cells: Cell[] = [];
    public controller!: ColumnsController;

    private _sanitizer: DomSanitizer;

    constructor(
        @SkipSelf() selfCdRef: ChangeDetectorRef,
        cdRef: ChangeDetectorRef,
        sanitizer: DomSanitizer,
    ) {
        super([cdRef, selfCdRef]);
        this._sanitizer = sanitizer;
    }

    @HostBinding('class') classes = 'row noreset';
    @HostBinding('style.background') background = '';
    @HostBinding('style.color') color = '';

    public ngAfterContentInit(): void {
        this.controller = this.row.session.render.getBoundEntity() as ColumnsController;
        this.cells = this.row.columns.map((s, i) => {
            return new Cell(this._sanitizer, this.controller, s, i);
        });
        this.env().subscriber.register(
            this.controller.update.subscribe(() => {
                this.markChangesForCheck();
            }),
        );
        this.env().subscriber.register(
            this.row.change.subscribe(() => {
                this.row.columns.map((s, i) => {
                    if (this.cells[i] === undefined) {
                        this.log().error(`Column ${i} doesn't exist`);
                        return;
                    }
                    this.cells[i].update(s);
                });
                this.background = this.row.background === undefined ? '' : this.row.background;
                this.color = this.row.color === undefined ? '' : this.row.color;
                this.markChangesForCheck();
            }),
        );
    }

    public visible(): Cell[] {
        return this.cells.filter((c) => c.visible());
    }
}
export interface Columns extends IlcInterface {}
