import {
    Component,
    OnDestroy,
    Input,
    AfterContentInit,
    ChangeDetectorRef,
    ElementRef,
} from '@angular/core';
import { Session } from '@service/session';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { DataSource } from '@platform/types/observe';

@Component({
    selector: 'app-views-observe-list',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class ObserveList extends ChangesDetector implements OnDestroy, AfterContentInit {
    @Input() session!: Session;

    public observed: Map<string, DataSource> = new Map();
    public selected: { uuid: string; source: DataSource } | undefined;

    constructor(cdRef: ChangeDetectorRef, private _self: ElementRef) {
        super(cdRef);
    }

    public ngOnDestroy() {
        //
    }

    public ngAfterContentInit(): void {
        this.env().subscriber.register(
            this.session.stream.subjects.get().observe.subscribe(() => {
                this.observed = this.session.stream.observed;
                this.detectChanges();
            }),
        );
        this.observed = this.session.stream.observed;
    }

    public ngSelect(uuid: string, source: DataSource): void {
        if (this.selected !== undefined && this.selected.uuid === uuid) {
            this.selected = undefined;
        } else {
            this.selected = { uuid, source };
        }
        this.detectChanges();
    }

    public ngGetCssClass(uuid: string): string {
        if (this.selected !== undefined && this.selected.uuid === uuid) {
            return 'selected';
        } else {
            return '';
        }
    }
}
export interface ObserveList extends IlcInterface {}
