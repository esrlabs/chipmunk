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

    public left(): {
        before(): number;
        after(): number;
    } {
        return {
            before: (): number => {
                return this.row.session.search.map.breadcrumbs.left(this.row.position).before();
            },
            after: (): number => {
                return this.row.session.search.map.breadcrumbs.left(this.row.position).after();
            },
        };
    }

    public before(event: MouseEvent) {
        stop(event);
        if (this.left().before() === 0) {
            return;
        }
        this.row.extending().before();
    }

    public after(event: MouseEvent) {
        stop(event);
        if (this.left().after() === 0) {
            return;
        }
        this.row.extending().after();
    }
}
export interface Separator extends IlcInterface {}
