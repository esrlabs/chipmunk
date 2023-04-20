import { Component, ChangeDetectorRef, Input, AfterContentInit, HostListener } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { DataSource, SourceDescription } from '@platform/types/observe';
import { Session } from '@service/session/session';
import { IMenuItem, contextmenu } from '@ui/service/contextmenu';
import { ObserveOperation } from '@service/session/dependencies/observing/operation';
import { stop } from '@ui/env/dom';

@Component({
    selector: 'app-transport-review',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class Transport extends ChangesDetector implements AfterContentInit {
    @Input() public source!: DataSource;
    @Input() public observer!: ObserveOperation | undefined;
    @Input() public session!: Session;
    @Input() public finished!: boolean;

    @HostListener('contextmenu', ['$event']) onContextMenu(event: MouseEvent) {
        const items: IMenuItem[] = [];
        const source = this.source;
        const observer = this.observer;
        const sourceDef = source.asSourceDefinition();
        if (source.asFile() !== undefined) {
            if (source.parser.Text !== undefined) {
                // Text file can be opened just once per session
                return;
            }
        }
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
            !(sourceDef instanceof Error) &&
                items.push(
                    ...[
                        {
                            caption: 'Restart',
                            handler: () => {
                                this.session.stream
                                    .connect(sourceDef)
                                    .source(source)
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
        !(sourceDef instanceof Error) &&
            items.push(
                ...[
                    {},
                    {
                        caption: 'Parameters',
                        handler: () => {
                            this.ilc()
                                .services.system.opener.stream(sourceDef, undefined, undefined)
                                .assign(this.session)
                                .source(
                                    this.source instanceof ObserveOperation
                                        ? this.source.asSource()
                                        : this.source,
                                );
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
    public description!: SourceDescription | undefined;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        const description = (
            this.source instanceof ObserveOperation ? this.source.asSource() : this.source
        ).desc();
        if (description instanceof Error) {
            this.log().error(`Invalid description: ${description.message}`);
            return;
        }
        this.description = description;
    }
}
export interface Transport extends IlcInterface {}
