import { Component, Input, ChangeDetectorRef, ElementRef, AfterContentInit } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Provider } from '../../providers/implementations/files';
import { Element } from '../../element/element';
import { State } from '../../states/serial';

@Component({
    selector: 'app-views-observed-list-serial',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class List extends ChangesDetector implements AfterContentInit {
    @Input() provider!: Provider;

    public tailing: Element[] = [];
    public offline: Element[] = [];
    public state!: State;

    constructor(cdRef: ChangeDetectorRef, private _self: ElementRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.state = this.provider.state;
        this.update();
        this.env().subscriber.register(
            this.provider.subjects.get().updated.subscribe(() => {
                this.update().detectChanges();
            }),
        );
    }

    protected update(): List {
        this.tailing = this.provider
            .sources()
            .filter((s) => s.observer !== undefined)
            .map((s) => new Element(s, this.provider));
        this.offline = this.provider
            .sources()
            .filter((s) => s.observer === undefined)
            .map((s) => new Element(s, this.provider));
        return this;
    }
}
export interface List extends IlcInterface {}
