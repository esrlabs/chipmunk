import {
    Component,
    ChangeDetectorRef,
    Input,
    OnChanges,
    SimpleChanges,
    ChangeDetectionStrategy,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Response } from '@platform/types/comment';

import * as moment from 'moment';

@Component({
    selector: 'app-views-comments-reply',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false,
})
@Initial()
@Ilc()
export class Reply extends ChangesDetector implements OnChanges {
    @Input() response!: Response;
    @Input() color!: string | undefined;
    @Input() edit!: () => void;
    @Input() remove!: () => void;
    @Input() icon!: boolean;
    @Input() editable!: boolean;

    constructor(private cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngOnRemove() {
        this.remove();
    }

    public ngOnEdit() {
        this.edit();
    }

    public ngOnChanges(changes: SimpleChanges) {
        const change = changes as unknown as { response: { currentValue: Response } };
        if (change.response === undefined) {
            return;
        }
        this.response = change.response.currentValue;
        this.detectChanges();
    }

    public created(): string {
        return moment.unix(this.response.created / 1000).format('MM/DD hh:mm:ss');
    }
}
export interface Reply extends IlcInterface {}
