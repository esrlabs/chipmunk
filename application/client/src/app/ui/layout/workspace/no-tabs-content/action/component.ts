import { Component, Input, ChangeDetectorRef, AfterViewInit } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Base } from '../actions/action';
import { Storage as ActionsStorage } from '../actions/storage';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { stop } from '@ui/env/dom';

@Component({
    selector: 'app-home-action',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class ActionComponent extends ChangesDetector implements AfterViewInit {
    @Input() public action!: Base;
    @Input() public actions!: ActionsStorage;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterViewInit(): void {
        this.env().subscriber.register(
            this.actions.updated.subscribe(() => {
                this.detectChanges();
            }),
        );
    }

    public isPinned() {
        return this.actions.isPinned(this.action.uuid());
    }

    public onPin(event: MouseEvent) {
        this.actions.toggle(this.action.uuid());
        stop(event);
    }
}
export interface ActionComponent extends IlcInterface {}
