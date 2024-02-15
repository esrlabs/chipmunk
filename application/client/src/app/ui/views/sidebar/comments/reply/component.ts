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
import { Response } from '@service/session/dependencies/comments/comment';

function getDateTimeStr(datetime: Date | number): string {
    function fill(num: number): string {
        return num >= 10 ? num.toString() : `0${num}`;
    }
    if (typeof datetime === 'number') {
        datetime = new Date(datetime);
    }
    return `${fill(datetime.getDate())}.${fill(datetime.getMonth() + 1)} ${fill(
        datetime.getHours(),
    )}:${fill(datetime.getMinutes())}`;
}

@Component({
    selector: 'app-views-comments-reply',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
@Initial()
@Ilc()
export class Reply extends ChangesDetector implements OnChanges {
    @Input() response!: Response;
    @Input() color!: string | undefined;
    @Input() edit!: () => void;
    @Input() remove!: () => void;
    @Input() icon!: boolean;

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

    public ngGetDateTime(): string {
        if (this.response.created === this.response.modified) {
            return getDateTimeStr(this.response.created);
        } else {
            return `${getDateTimeStr(this.response.created)} / ${getDateTimeStr(
                this.response.modified,
            )}`;
        }
    }
}
export interface Reply extends IlcInterface {}
