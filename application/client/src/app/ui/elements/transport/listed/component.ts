import { Component, ChangeDetectorRef, Input, AfterContentInit, HostListener } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { DataSource, SourceDescription } from '@platform/types/observe';
import { Session } from '@service/session/session';
import { IMenuItem, contextmenu } from '@ui/service/contextmenu';
import { ObserveOperation } from '@service/session/dependencies/observe/operation';

@Component({
    selector: 'app-transport-review',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class Transport extends ChangesDetector implements AfterContentInit {
    @Input() public source!: DataSource | ObserveOperation;
    @Input() public session!: Session;
    @Input() public finished!: boolean;

    @HostListener('contextmenu', ['$event']) onContextMenu(event: MouseEvent) {
        const items: IMenuItem[] = [];
        const source = this.source;
        const sourceDef =
            source instanceof DataSource
                ? source.asSourceDefinition()
                : source.asSource().asSourceDefinition();
        const dataSource = source instanceof DataSource ? source : source.asSource();
        if (dataSource.File !== undefined) {
            if (dataSource.File[1].Text !== undefined) {
                // Text file can be opened just once per session
                return;
            }
        }
        if (source instanceof ObserveOperation) {
            items.push(
                ...[
                    {
                        caption: 'Stop',
                        handler: () => {
                            source
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
                            source
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
        } else if (source instanceof DataSource) {
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
                                .services.system.opener.stream(sourceDef)
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
        event.stopImmediatePropagation();
        event.preventDefault();
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
