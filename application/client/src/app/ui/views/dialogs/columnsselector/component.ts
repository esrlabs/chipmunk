import { Component, ChangeDetectorRef, Input, AfterContentInit } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Initial } from '@env/decorators/initial';
import { Session } from '@service/session/session';
import { Columns, Header } from '@schema/render/columns';
import { getContrastColor } from '@ui/styles/colors';

@Component({
    selector: 'app-dialogs-columns-selector',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    standalone: false,
})
@Initial()
@Ilc()
export class ColumnsSelector extends ChangesDetector implements AfterContentInit {
    @Input() public session!: Session;
    @Input() public accept!: (columns: number[], delimiter: string | undefined) => void;
    @Input() public close!: () => void;

    public headers: Header[] = [];
    public selected: { [key: number]: boolean } = {};
    public delimiter: string = ';';

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        const bound = this.session.render.getBoundEntity();
        if (!(bound instanceof Columns)) {
            this.headers = [];
            return;
        }
        const controller = bound as unknown as Columns;
        this.headers = controller.get().all();
        this.headers.forEach((h) => {
            this.selected[h.index] = h.visible;
        });
    }

    public export() {
        const indexes: number[] = [];
        Object.keys(this.selected).forEach((key: string) => {
            if (this.selected[key as unknown as number] === true) {
                indexes.push(parseInt(key, 10));
            }
        });
        this.accept(indexes, this.delimiter);
        this.close();
    }

    public getBgColor(header: Header) {
        return {
            background: header.color,
        };
    }
    public getFgColor(header: Header) {
        return {
            color: header.color === undefined ? undefined : getContrastColor(header.color, true),
        };
    }

    public disabled(): boolean {
        return (
            Object.keys(this.selected).find(
                (k: string) => this.selected[k as unknown as number],
            ) === undefined || this.delimiter === ''
        );
    }
}
export interface ColumnsSelector extends IlcInterface {}
