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
    standalone: false,
})
@Ilc()
export class LayoutPopup extends ChangesDetector implements AfterViewInit, AfterContentInit {
    @Input() public popup!: Popup;
    @Input() public close!: () => void;

    public width: string = 'auto';
    public height: string = 'auto';

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
        const options = this.popup.options;
        if (!options) {
            return;
        }
        if (options.size && options.size.width) {
            const abs = options.size.width <= 1;
            this.width = `${abs ? options.size.width * 100 : options.size.width}${
                abs ? '%' : 'px'
            }`;
        } else {
            this.width = 'auto';
        }
        if (options.size && options.size.height) {
            const abs = options.size.height <= 1;
            this.height = `${abs ? options.size.height * 100 : options.size.height}${
                abs ? '%' : 'px'
            }`;
        } else {
            this.height = 'auto';
        }
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

    public ngStyle(): {
        width: string;
        height: string;
        maxWidth: string;
        maxHeight: string;
        position: string;
    } {
        return {
            width: this.width,
            height: this.height,
            maxWidth: this.width.endsWith('%') ? 'none' : '70%',
            maxHeight: this.height.endsWith('%') ? 'none' : '80%',
            position:
                this.width.endsWith('%') || this.height.endsWith('%') ? 'absolute' : 'relative',
        };
    }
}
export interface LayoutPopup extends IlcInterface {}
