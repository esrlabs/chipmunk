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
                ],
            );
        } else {
            items.push(
                ...[
                    {
                        caption: 'Restart',
                        handler: () => {
                            //
                        },
                    },
                ],
            );
        }
        items.push(
            ...[
                {},
                {
                    caption: 'Clone',
                    handler: () => {
                        //
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
