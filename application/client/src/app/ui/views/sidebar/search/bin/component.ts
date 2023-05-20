import {
    Component,
    ChangeDetectorRef,
    HostBinding,
    HostListener,
    OnDestroy,
    Input,
    AfterContentInit,
} from '@angular/core';
import { CdkDropList, CdkDragDrop } from '@angular/cdk/drag-drop';
import { ListId } from '../base/list';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Subscription } from 'rxjs';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Provider } from '../providers/definitions/provider';
import { Providers } from '../providers/providers';

@Component({
    selector: 'app-sidebar-entities-bin',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    hostDirectives: [
        {
            directive: CdkDropList,
        },
    ],
})
@Ilc()
export class Bin extends ChangesDetector implements AfterContentInit, OnDestroy {
    @Input() providers!: Providers;

    @HostListener('window:mouseup') onWindowMouseUp() {
        this._dragging = false;
        this.detectChanges();
    }

    @HostBinding('id') get id(): string {
        return ListId.Bin;
    }

    @HostBinding('attr.data-dragging') get dragging(): boolean {
        return this._dragging;
    }

    protected readonly subscriptions: Subscription[] = [];

    private _dragging: boolean = false;

    constructor(
        protected readonly cdRef: ChangeDetectorRef,
        protected readonly cdkDropListDir: CdkDropList,
    ) {
        super(cdRef);
        this.cdkDropListDir.id = ListId.Bin;
        this.cdkDropListDir.lockAxis = 'y';
        this.subscriptions.push(
            ...[
                this.cdkDropListDir.dropped.subscribe((event: CdkDragDrop<any>) => {
                    const provider: Provider<unknown> | undefined = event.previousContainer.data;
                    if (!(provider instanceof Provider)) {
                        return;
                    }
                    const dragged = provider.getEntityByIndex(event.previousIndex);
                    if (dragged === undefined) {
                        return;
                    }
                    provider.removeEntity(dragged);
                }),
            ],
        );
    }

    public ngOnDestroy(): void {
        this.subscriptions.forEach((s) => s.unsubscribe());
    }

    public ngAfterContentInit(): void {
        this.env().subscriber.register(
            this.providers.subjects.get().dragging.subscribe(() => {
                this._dragging = true;
                this.detectChanges();
            }),
        );
    }
}
export interface Bin extends IlcInterface {}
