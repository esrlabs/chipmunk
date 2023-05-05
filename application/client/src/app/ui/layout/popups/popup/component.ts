import {
    Component,
    ChangeDetectorRef,
    AfterViewInit,
    AfterContentInit,
    ChangeDetectionStrategy,
    Input,
    HostBinding,
    HostListener,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Popup } from '@ui/service/popup';

@Component({
    selector: 'app-layout-popup',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
@Ilc()
export class LayoutPopup extends ChangesDetector implements AfterViewInit, AfterContentInit {
    @Input() public popup!: Popup;
    @Input() public close!: () => void;

    @HostBinding('class') get cssClassEdited() {
        if (this.popup.options.position === undefined) {
            return `v-bottom h-center`;
        } else {
            return `v-${this.popup.options.position.vertical} h-${this.popup.options.position.horizontal}`;
        }
    }

    @HostListener('click', ['$event']) onClick(event: MouseEvent) {
        if ((event.target as HTMLElement).tagName.toLowerCase() === 'app-layout-popup') {
            if (this.popup.options.closable === false) {
                return;
            }
            if (this.popup.options.closeOnBGClick === false) {
                return;
            }
            this.close();
        }
    }

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.popup.options.component.inputs =
            this.popup.options.component.inputs === undefined
                ? {}
                : this.popup.options.component.inputs;
        this.popup.options.component.inputs.close = this.close;
        this.popup.options.component.inputs.popup = this.popup;
    }

    public ngAfterViewInit(): void {
        this.env().subscriber.register(
            this.ilc().services.ui.listener.listen<KeyboardEvent>(
                'keydown',
                window,
                (event: KeyboardEvent) => {
                    if (this.popup.options.closable === false) {
                        return true;
                    }
                    if (this.popup.options.closeOnKey === undefined) {
                        return true;
                    }
                    if (this.popup.options.closeOnKey === '*') {
                        this.close();
                        return true;
                    }
                    const keys = this.popup.options.closeOnKey.split(',');
                    if (keys.includes(event.key)) {
                        this.close();
                    }
                    return true;
                },
            ),
        );
    }

    public ngStyle(): { width: string } {
        if (this.popup.options === undefined || this.popup.options.width === undefined) {
            return { width: 'auto' };
        } else {
            return { width: `${this.popup.options.width}px` };
        }
    }
}
export interface LayoutPopup extends IlcInterface {}
