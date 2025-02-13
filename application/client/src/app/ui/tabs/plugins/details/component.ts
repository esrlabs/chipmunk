import {
    Component,
    ChangeDetectorRef,
    Input,
    ViewChild,
    ElementRef,
    AfterViewInit,
    AfterContentInit,
    OnDestroy,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { micromark } from 'micromark';
import { PluginDesc } from '../desc';
import { Provider } from '../provider';
import { bridge } from '@service/bridge';

import * as dom from '@ui/env/dom';

@Component({
    selector: 'app-plugins-manager-details',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    standalone: false,
})
@Initial()
@Ilc()
export class Details extends ChangesDetector implements AfterViewInit, AfterContentInit, OnDestroy {
    @Input() public provider!: Provider;
    @Input() public plugin!: PluginDesc;

    @ViewChild('content') contentRef!: ElementRef<HTMLElement>;

    public readme: SafeHtml = '';
    public loading: boolean = false;

    protected async load(): Promise<void> {
        const drop = () => {
            this.loading = false;
            this.readme = '';
            this.detectChanges();
        };
        this.loading = true;
        this.links().unbind();
        this.detectChanges();
        if (!this.plugin.path) {
            return drop();
        }
        const delimiter = await bridge.folders().delimiter();
        const path = `${this.plugin.path.filename}${delimiter}README.md`;
        if (!(await bridge.files().exists(path))) {
            return drop();
        }
        bridge
            .files()
            .read(path)
            .then((content: string) => {
                this.readme = this.sanitizer.bypassSecurityTrustHtml(micromark(content));
                this.detectChanges();
                this.links().bind();
            })
            .catch((err: Error) => {
                this.log().error(`Fail to read "${path}": ${err.message}`);
                this.readme = '';
            })
            .finally(() => {
                this.loading = false;
                this.detectChanges();
            });
    }

    protected links(): {
        bind(): void;
        unbind(): void;
    } {
        return {
            bind: (): void => {
                const links = this.contentRef.nativeElement.querySelectorAll('a');
                if (links === null) {
                    return;
                }
                links.forEach((link: HTMLAnchorElement) => {
                    link.addEventListener('click', this.redirect);
                });
            },
            unbind: (): void => {
                const links = this.contentRef.nativeElement.querySelectorAll('a');
                if (links === null) {
                    return;
                }
                links.forEach((link: HTMLAnchorElement) => {
                    link.removeEventListener('click', this.redirect);
                });
            },
        };
    }

    protected safeLoad(): void {
        this.load().catch((err: Error) => {
            this.log().error(`Fail to load plugin's details: ${err.message}`);
        });
    }

    protected redirect(event: MouseEvent): void {
        dom.stop(event);
        // TODO: safe openening URL
    }

    constructor(cdRef: ChangeDetectorRef, protected readonly sanitizer: DomSanitizer) {
        super(cdRef);
    }

    public ngAfterViewInit(): void {
        this.safeLoad();
    }

    public ngAfterContentInit(): void {
        this.env().subscriber.register(
            this.provider.subjects.get().selected.subscribe(() => {
                this.safeLoad();
            }),
        );
    }

    public ngOnDestroy(): void {
        this.links().unbind();
    }
}

export interface Details extends IlcInterface {}
