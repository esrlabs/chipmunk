import {
    Component,
    Input,
    ChangeDetectorRef,
    ElementRef,
    ViewEncapsulation,
    ChangeDetectionStrategy,
    AfterContentInit,
} from '@angular/core';
import { session, Session } from '@service/session';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { popup, Vertical, Horizontal } from '@ui/service/popup';
import { SetupObserve } from '@tabs/setup/component';
import { SessionOrigin } from '@service/session/origin';
import { components } from '@service/components';
import { Ident } from '@platform/types/bindings';

interface Action {
    icon: string;
    title: string;
    handler: () => void;
}

@Component({
    selector: 'app-attach-new-source-menu',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    standalone: false,
})
@Ilc()
export class AttachSourceMenu extends ChangesDetector implements AfterContentInit {
    @Input() session!: Session;

    public loading: boolean = true;
    public error: string | undefined;

    protected logAndSetErr(msg: string) {
        this.error = msg;
        this.log().error(msg);
    }

    public actions: Array<Action | null> = [
        {
            icon: '',
            title: 'Attach New',
            handler: () => {
                session.initialize().attach(this.session, undefined);
            },
        },
    ];

    constructor(cdRef: ChangeDetectorRef, private _self: ElementRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        const origin = this.session.stream.getOrigin();
        if (!origin) {
            this.logAndSetErr(`No origin linked to the session`);
            return;
        }
        const parser = origin.components?.parser?.uuid;
        if (!parser) {
            this.logAndSetErr(`No parser linked to the origin of the session`);
            return;
        }
        const source = origin.components?.source?.uuid;
        if (!source) {
            this.logAndSetErr(`No source linked to the origin of the session`);
            return;
        }
        components
            .get(origin.origin)
            .sourcesForParser(parser)
            .then((sources: Ident[]) => {
                if (sources.length <= 1) {
                    return;
                }
                this.actions.push(null);
                this.actions.push(
                    ...sources
                        .filter((src) => src.uuid !== source)
                        .map((src) => {
                            return {
                                icon: '',
                                title: src.name,
                                handler: () => {
                                    session.initialize().attach(this.session, src.uuid);
                                },
                            };
                        }),
                );
                this.detectChanges();
            })
            .catch((err: Error) => {
                this.logAndSetErr(err.message);
            })
            .finally(() => {
                this.loading = false;
                this.detectChanges();
            });
    }
}
export interface AttachSourceMenu extends IlcInterface {}
