import {
    Component,
    ChangeDetectorRef,
    ChangeDetectionStrategy,
    Input,
    AfterViewInit,
    AfterContentInit,
    OnDestroy,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { SessionOrigin } from '@service/session/origin';

@Component({
    selector: 'app-tabs-setup-origin',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false,
})
@Initial()
@Ilc()
export class SourceOriginComponent implements AfterContentInit, OnDestroy {
    @Input() origin!: SessionOrigin;

    public title: string = '';
    public description: string | undefined;

    public ngOnDestroy(): void {}

    public ngAfterContentInit(): void {
        const description = this.origin.getDescription();
        this.title = description.title;
        this.description = description.desctiption;
    }
}
export interface SourceOriginComponent extends IlcInterface {}
