import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';

export interface IButton {
    icon: string;
    handler: () => void;
}

@Component({
    selector: 'app-views-observed-list-title',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class Title {
    @Input() title!: string;
    @Input() subtitle: string | undefined;
    @Input() buttons: IButton[] = [];
    @Input() opened!: boolean;
    @Input() hideToggle: boolean | undefined;
    @Output() toggled: EventEmitter<boolean> = new EventEmitter();

    public click(button: IButton) {
        button.handler();
    }

    public toggle() {
        this.opened = !this.opened;
        this.toggled.emit(this.opened);
    }
}
export interface Title extends IlcInterface {}
