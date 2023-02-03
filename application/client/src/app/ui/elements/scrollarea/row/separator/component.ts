import { Component, Input, HostBinding } from '@angular/core';
import { Row } from '@schema/content/row';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { stop } from '@ui/env/dom';

@Component({
    selector: 'app-scrollarea-rows-separator',
    styleUrls: ['./styles.less'],
    templateUrl: './template.html',
})
@Ilc()
export class Separator {
    @Input() public row!: Row;

    @HostBinding('class') classes = 'row';

    public before(event: MouseEvent) {
        stop(event);
        this.row.extending().before();
    }

    public after(event: MouseEvent) {
        stop(event);
        this.row.extending().after();
    }
}
export interface Separator extends IlcInterface {}
