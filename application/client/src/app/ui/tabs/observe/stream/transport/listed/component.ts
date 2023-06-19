import { Component, ChangeDetectorRef, Input, AfterContentInit, HostListener } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Session } from '@service/session/session';
import { IMenuItem, contextmenu } from '@ui/service/contextmenu';
import { ObserveOperation } from '@service/session/dependencies/observing/operation';
import { stop } from '@ui/env/dom';

import * as $ from '@platform/types/observe';

@Component({
    selector: 'app-transport-review',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class Transport extends ChangesDetector implements AfterContentInit {
    @Input() public observe!: $.Observe;
    @Input() public observer!: ObserveOperation | undefined;
    @Input() public session!: Session;
    @Input() public finished!: boolean;

    @HostListener('contextmenu', ['$event']) onContextMenu(event: MouseEvent) {
        const items: IMenuItem[] = [];
        const observer = this.observer;
        if (this.observe.origin.files() !== undefined) {
            if (this.observe.parser.instance instanceof $.Parser.Text.Configuration) {
                // Text file can be opened just once per session
                return;
            }
        }
        const stream = this.observe.origin.as<$.Origin.Stream.Configuration>(
            $.Origin.Stream.Configuration,
        );
        if (observer !== undefined) {
            items.push(
                ...[
                    {
                        caption: 'Stop',
                        handler: () => {
                            observer
                                .abort()
                                .catch((err: Error) => {
                                    this.log().error(
                                        `Fail to stop observe operation: ${err.message}`,
                                    );
                                })
                                .finally(() => {
                                    this.detectChanges();
                                });
                        },
                    },
                    {
                        caption: 'Restart',
                        handler: () => {
                            observer
                                .restart()
                                .catch((err: Error) => {
                                    this.log().error(
                                        `Fail to restart observe operation: ${err.message}`,
                                    );
                                })
                                .finally(() => {
                                    this.detectChanges();
                                });
                        },
                    },
                ],
            );
        } else if (observer === undefined) {
            stream !== undefined &&
                items.push(
                    ...[
                        {
                            caption: 'Restart',
                            handler: () => {
                                this.ilc()
                                    .services.system.session.initialize()
                                    .observe(this.observe, this.session)
                                    .catch((err: Error) => {
                                        this.log().error(
                                            `Fail to restart observe operation: ${err.message}`,
                                        );
                                    })
                                    .finally(() => {
                                        this.detectChanges();
                                    });
                            },
                        },
                    ],
                );
        }
        stream !== undefined &&
            items.push(
                ...[
                    {},
                    {
                        caption: 'Parameters',
                        handler: () => {
                            this.ilc()
                                .services.system.session.initialize()
                                .configure(this.observe, this.session);
                        },
                    },
                ],
            );
        contextmenu.show({
            items: items,
            x: event.pageX,
            y: event.pageY,
        });
        stop(event);
    }
    public description!: $.IOriginDetails | undefined;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        const description = this.observe.origin.desc();
        if (description instanceof Error) {
            this.log().error(`Invalid description: ${description.message}`);
            return;
        }
        this.description = description;
    }
}
export interface Transport extends IlcInterface {}
