import { Component, ChangeDetectorRef, AfterViewInit, OnDestroy } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Session as ActiveSession } from '@service/session';
import { Subscriber } from '@platform/env/subscription';
import { IInfoBlock } from '@service/session/dependencies/info';

@Component({
    selector: 'app-statusbar-info',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    standalone: false,
})
@Ilc()
export class SessionInfo extends ChangesDetector implements AfterViewInit, OnDestroy {
    protected subscriber: Subscriber = new Subscriber();

    protected bind(): void {
        this.subscriber.unsubscribe();
        !this.access().session((active: ActiveSession) => {
            this.subscriber.register(
                active.info.updated.subscribe(() => {
                    this.blocks = active.info.get();
                    this.detectChanges();
                }),
            );
            this.blocks = active.info.get();
            this.detectChanges();
        }) && (this.blocks = []);
    }

    public blocks: IInfoBlock[] = [];

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    ngOnDestroy(): void {
        this.subscriber.unsubscribe();
    }

    ngAfterViewInit(): void {
        this.ilc().channel.session.change(() => {
            this.bind();
        });
        this.bind();
    }
}
export interface SessionInfo extends IlcInterface {}
