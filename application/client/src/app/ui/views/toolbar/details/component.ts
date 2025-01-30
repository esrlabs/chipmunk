import { Component, AfterViewInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { Session } from '@service/session';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Subscriber } from '@platform/env/subscription';
import { Row, RowSrc } from '@schema/content/row';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
    selector: 'app-views-details',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    standalone: false,
})
@Initial()
@Ilc()
export class Details extends ChangesDetector implements AfterViewInit, OnDestroy {
    protected session: Session | undefined;
    protected subscriber: Subscriber = new Subscriber();
    protected sanitizer: DomSanitizer;

    public row: RowSrc | undefined;
    public origin: SafeHtml | undefined;
    public parsed: SafeHtml | undefined;

    constructor(cdRef: ChangeDetectorRef, sanitizer: DomSanitizer) {
        super(cdRef);
        this.sanitizer = sanitizer;
    }

    public ngOnDestroy(): void {
        this.subscriber.unsubscribe();
    }

    public ngAfterViewInit(): void {
        this.env().subscriber.register(
            this.ilc().channel.session.change(this.bind.bind(this)),
            this.ilc().services.system.hotkeys.listen('Ctrl + C', () => {
                const selection = document.getSelection();
                if (selection === null) {
                    return;
                }
                this.copy(selection.toString());
            }),
        );
        this.bind().update();
    }

    public copy(content?: string): void {
        const row = this.row;
        if (row === undefined) {
            return;
        }
        navigator.clipboard.writeText(
            (() => {
                if (content !== undefined) {
                    return content;
                }
                const parsed = document.querySelector('pre[id="parsed_content_holder"]');
                if (parsed !== null) {
                    return parsed.textContent as string;
                } else {
                    return row.content;
                }
            })()
                .replace(/\u0006/gi, '\n')
                .replace(/\t/gi, ' '.repeat(4)),
        );
    }

    protected bind(): Details {
        this.subscriber.unsubscribe();
        this.session = this.ilc().services.system.session.active().session();
        this.session !== undefined &&
            this.subscriber.register(
                this.session.cursor.subjects.get().selected.subscribe(this.update.bind(this)),
                this.session.cursor.subjects.get().loaded.subscribe(this.update.bind(this)),
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
            if (this.row === undefined) {
                this.origin = undefined;
                this.parsed = undefined;
            } else {
                this.origin = this.sanitizer.bypassSecurityTrustHtml(
                    this.row.content.replace(/\u0006/gi, '<br>').replace(/\t/gi, ' '.repeat(4)),
                );
                const row = new Row(this.row);
                this.parsed =
                    row.html !== undefined
                        ? this.sanitizer.bypassSecurityTrustHtml(row.html)
                        : undefined;
                row.destroy();
            }
        }
        this.detectChanges();
    }
}
export interface Details extends IlcInterface {}
