import {
    Component,
    Input,
    ChangeDetectorRef,
    ElementRef,
    ViewEncapsulation,
    ChangeDetectionStrategy,
} from '@angular/core';
import { Session } from '@service/session';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';

import * as Factory from '@platform/types/observe/factory';
import { SessionOrigin } from '@service/session/origin';

@Component({
    selector: 'app-attach-new-source-menu',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    standalone: false,
})
@Ilc()
export class AttachSourceMenu extends ChangesDetector {
    @Input() session!: Session;

    public actions: Array<{ icon: string; title: string; handler: () => void } | null> = [
        {
            icon: 'note_add',
            title: 'Attach Files',
            handler: () => {
                throw new Error(`Not implemented!`);
            },
        },
        null,
        {
            icon: 'input',
            title: 'Connect TCP',
            handler: () => {
                this.ilc()
                    .services.system.session.initialize()
                    .configure(SessionOrigin.source(), this.session);
            },
        },
        {
            icon: 'input',
            title: 'Connect UDP',
            handler: () => {
                this.ilc()
                    .services.system.session.initialize()
                    .configure(SessionOrigin.source(), this.session);
            },
        },
        {
            icon: 'settings_input_composite',
            title: 'Connect Serial',
            handler: () => {
                this.ilc()
                    .services.system.session.initialize()
                    .configure(SessionOrigin.source(), this.session);
            },
        },
        null,
        {
            icon: 'minimize',
            title: 'Command',
            handler: () => {
                this.ilc()
                    .services.system.session.initialize()
                    .configure(SessionOrigin.source(), this.session);
            },
        },
    ];

    constructor(cdRef: ChangeDetectorRef, private _self: ElementRef) {
        super(cdRef);
    }

    public attach(): {
        disabled(): boolean;
        error(): string | undefined;
    } {
        return {
            disabled: (): boolean => {
                // return this.session.observed.getNewSourceError() instanceof Error;
                console.error(`Not implemented`);
                return true;
            },
            error: (): string | undefined => {
                // const error = this.session.observed.getNewSourceError();
                // return error instanceof Error ? error.message : undefined;
                console.error(`Not implemented`);
                return undefined;
            },
        };
    }
}
export interface AttachSourceMenu extends IlcInterface {}
