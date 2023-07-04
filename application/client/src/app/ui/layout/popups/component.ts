import {
    Component,
    ChangeDetectorRef,
    AfterContentInit,
    ChangeDetectionStrategy,
    HostBinding,
    SkipSelf,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Popup } from '@ui/service/popup';

@Component({
    selector: 'app-layout-popups',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
@Ilc()
export class LayoutPopups extends ChangesDetector implements AfterContentInit {
    public popups: Map<string, { popup: Popup; close: () => void }> = new Map();
    protected visible: boolean = false;

    @HostBinding('class') get visability() {
        return this.visible ? 'visible' : 'hidden';
    }

    constructor(@SkipSelf() selfCdRef: ChangeDetectorRef, cdRef: ChangeDetectorRef) {
        super([selfCdRef, cdRef]);
    }

    public ngAfterContentInit(): void {
        this.ilc().channel.ui.popup.open((popup: Popup) => {
            if (this.popups.has(popup.uuid)) {
                return;
            }
            popup.options.component.inputs === undefined && (popup.options.component.inputs = {});
            popup.options.component.inputs.close = this._close.bind(this, popup.uuid);
            this.popups.set(popup.uuid, { popup, close: this._close.bind(this, popup.uuid) });
            this.visible = true;
            this.ilc().services.ui.popup.setCount(this.popups.size);
            this.ilc().emitter.ui.popup.updated(this.popups.size);
            this.markChangesForCheck();
            popup.subjects.get().opened.emit();
        });
        this.ilc().channel.ui.popup.close((uuid: string) => {
            this._close(uuid);
        });
    }

    public onBGClick(): void {
        this.popups.forEach((popup, uuid) => {
            if (popup.popup.options.closable === false) {
                return;
            }
            if (popup.popup.options.closeOnBGClick === false) {
                return;
            }
            this._close(uuid);
        });
    }

    private _close(uuid: string): void {
        const stored = this.popups.get(uuid);
        if (stored === undefined) {
            return;
        }
        this.popups.delete(uuid);
        this.popups.size === 0 && (this.visible = false);
        this.ilc().services.ui.popup.setCount(this.popups.size);
        this.ilc().emitter.ui.popup.updated(this.popups.size);
        this.markChangesForCheck();
        stored.popup.subjects.get().closed.emit();
    }
}
export interface LayoutPopups extends IlcInterface {}
