import {
    Component,
    Input,
    ChangeDetectorRef,
    AfterContentInit,
    HostBinding,
    SkipSelf,
    ViewEncapsulation,
    ChangeDetectionStrategy,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { Row } from '@schema/content/row';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Columns as Controller } from '@schema/render/columns';
import { Cell } from './cell';
import { ChangesDetector } from '@ui/env/extentions/changes';

@Component({
    selector: 'app-scrollarea-row-columns',
    styleUrls: ['./styles.less'],
    templateUrl: './template.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false,
})
@Ilc()
export class Columns extends ChangesDetector implements AfterContentInit {
    @Input() public row!: Row;

    public cells: Cell[] = [];
    public controller!: Controller;
    public visible: Cell[] = [];

    private _sanitizer: DomSanitizer;

    constructor(
        @SkipSelf() selfCdRef: ChangeDetectorRef,
        cdRef: ChangeDetectorRef,
        sanitizer: DomSanitizer,
    ) {
        super([cdRef, selfCdRef]);
        this._sanitizer = sanitizer;
    }

    @HostBinding('class') classes = 'row';
    @HostBinding('style.background') background = '';
    @HostBinding('style.color') color = '';

    public ngAfterContentInit(): void {
        this.controller = this.row.session.render.getBoundEntity() as Controller;
        this.cells = this.row.columns.map((s, i) => {
            return new Cell(this._sanitizer, this.controller, s, i);
        });
        this.visible = this.cells.filter((c) => c.visible);
        this.env().subscriber.register(
            this.controller.subjects.get().resized.subscribe((index: number) => {
                this.cells[index].update().styles();
                this.detectChanges();
            }),
            this.controller.subjects.get().visibility.subscribe((index: number) => {
                this.cells[index].update().visability();
                this.visible = this.cells.filter((c) => c.visible);
                this.detectChanges();
            }),
            this.controller.subjects.get().colorize.subscribe((index: number) => {
                this.cells[index].update().styles();
                this.detectChanges();
            }),
            this.row.change.subscribe(() => {
                this.row.columns.map((s, i) => {
                    if (this.cells[i] === undefined) {
                        this.log().error(`Column ${i} doesn't exist`);
                        return;
                    }
                    this.cells[i].update().content(s);
                });
                this.background = this.row.background === undefined ? '' : this.row.background;
                this.color = this.row.color === undefined ? '' : this.row.color;
                this.detectChanges();
            }),
        );
    }
}
export interface Columns extends IlcInterface {}
