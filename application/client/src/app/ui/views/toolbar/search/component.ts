import {
    Component,
    Input,
    AfterContentInit,
    ChangeDetectorRef,
    ChangeDetectionStrategy,
} from '@angular/core';
import { Session } from '@service/session';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { Service } from '@elements/scrollarea/controllers/service';
import { Columns } from '@schema/render/columns';
import { ChangesDetector } from '@ui/env/extentions/changes';

@Component({
    selector: 'app-views-search',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false,
})
@Initial()
@Ilc()
export class ViewSearch extends ChangesDetector implements AfterContentInit {
    @Input() public session!: Session;

    public service!: Service;
    public columns: Columns | undefined;
    public nested!: boolean;

    constructor(chRef: ChangeDetectorRef) {
        super(chRef);
    }

    public ngAfterContentInit(): void {
        this.nested = this.session.search.state().nested().visible();
        this.env().subscriber.register(
            this.session.search.state().subjects.nested.subscribe((visible: boolean) => {
                this.nested = visible;
                this.detectChanges();
            }),
            this.ilc().services.system.hotkeys.listen('Ctrl + Shift + F', () => {
                this.session.search.state().nested().toggle();
            }),
        );
    }
}
export interface ViewSearch extends IlcInterface {}
