import { Component, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { Session } from '@service/session';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Subscriber } from '@platform/env/subscription';
import { Row } from '@schema/content/row';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
    selector: 'app-views-details',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class Details extends ChangesDetector implements AfterViewInit {
    protected session: Session | undefined;
    protected subscriber: Subscriber = new Subscriber();
    protected sanitizer: DomSanitizer;

    public row: Row | undefined;
    public origin: SafeHtml | undefined;
    public parsed: SafeHtml | undefined;

    constructor(cdRef: ChangeDetectorRef, sanitizer: DomSanitizer) {
        super(cdRef);
        this.sanitizer = sanitizer;
    }

    public ngAfterViewInit(): void {
        this.env().subscriber.register(this.ilc().channel.session.change(this.bind.bind(this)));
        this.bind().update();
    }

    public copy(): void {
        const row = this.row;
        if (row === undefined) {
            return;
        }
        navigator.clipboard.writeText(
            (() => {
                const parsed = document.querySelector('p[id="parsed_content_holder"]');
                if (parsed !== null) {
                    return parsed.textContent as string;
                } else {
                    return row.content;
                }
            })(),
        );
    }

    protected bind(): Details {
        this.subscriber.unsubscribe();
        this.session = this.ilc().services.system.session.active().session();
        this.session !== undefined &&
            this.subscriber.register(
                this.session.cursor.subjects.get().selected.subscribe(this.update.bind(this)),
            );
        return this;
    }

    protected update() {
        if (this.session === undefined) {
            this.row = undefined;
            this.origin = undefined;
            this.parsed = undefined;
        } else {
            this.row = this.session.cursor.getSingle().row();
            this.origin =
                this.row !== undefined
                    ? this.sanitizer.bypassSecurityTrustHtml(this.row.content)
                    : undefined;
            this.parsed =
                this.row !== undefined && this.row.html !== undefined
                    ? this.sanitizer.bypassSecurityTrustHtml(this.row.html)
                    : undefined;
        }
        this.detectChanges();
    }
}
export interface Details extends IlcInterface {}
