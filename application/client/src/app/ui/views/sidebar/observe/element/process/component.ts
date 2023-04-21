import { Component, Input, ChangeDetectorRef, ElementRef, AfterContentInit } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { ProcessTransportSettings } from '@platform/types/observe';
import { Element } from '../element';
import { Mutable } from '@platform/types/unity/mutable';
import { stop } from '@ui/env/dom';

@Component({
    selector: 'app-views-observed-process',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class Item extends ChangesDetector implements AfterContentInit {
    @Input() element!: Element;

    public readonly process: ProcessTransportSettings | undefined;
    public readonly selected!: boolean;

    constructor(cdRef: ChangeDetectorRef, private _self: ElementRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        const origin = this.element.source.source.origin;
        if (origin.Stream === undefined) {
            this.log().error(`Expected origin Source`);
            return;
        }
        if (origin.Stream[1].Process === undefined) {
            this.log().error(`Expected origin Source would be Process`);
            return;
        }
        (this as Mutable<Item>).process = origin.Stream[1].Process;
    }

    public isActive(): boolean {
        return this.element.source.observer !== undefined;
    }

    public restart(event: MouseEvent): void {
        stop(event);
        this.element.provider.repeat(this.element.source.source).catch((err: Error) => {
            this.log().error(`Fail to restart process: ${err.message}`);
        });
    }

    public stop(event: MouseEvent): void {
        stop(event);
        const observer = this.element.source.observer;
        if (observer === undefined) {
            return;
        }
        observer.abort().catch((err: Error) => {
            this.log().error(`Fail to abort process: ${err.message}`);
        });
    }
}
export interface Item extends IlcInterface {}
