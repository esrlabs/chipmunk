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
import { PluginDescription } from '../desc';
import { Provider } from '../provider';
import { PluginRunData, PluginLogLevel } from '@platform/types/bindings/plugins';

import * as dom from '@ui/env/dom';

enum Tab {
    ReadMe,
    Inspecting,
}

interface ParsedLogMessage {
    msg: string;
    dt: string;
    level: PluginLogLevel;
}

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
    @Input() public plugin!: PluginDescription;

    @ViewChild('content') contentRef!: ElementRef<HTMLElement>;

    public get Tab(): typeof Tab {
        return Tab;
    }
    public readme: SafeHtml = '';
    public logs: ParsedLogMessage[] = [];
    public loading: boolean = false;
    public tab: Tab = Tab.ReadMe;

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
        if (this.plugin.readmePath !== undefined) {
            this.provider
                .readme(this.plugin.readmePath)
                .then((content: string | undefined) => {
                    if (content !== undefined) {
                        this.readme = this.sanitizer.bypassSecurityTrustHtml(micromark(content));
                        this.detectChanges();
                        this.links().bind();
                    } else {
                        drop();
                    }
                })
                .catch((err: Error) => {
                    this.log().error(`Fail to read "${this.plugin.getPath()}": ${err.message}`);
                    this.readme = '';
                })
                .finally(() => {
                    this.loading = false;
                    this.detectChanges();
                });
        } else {
            drop();
        }
    }

    protected fetchRunData() {
        this.loading = true;
        this.logs = [];
        this.detectChanges();
        this.provider
            .getRunData(this.plugin.getPath())
            .then((rd: PluginRunData | undefined) => {
                if (rd !== undefined) {
                    this.logs = rd.logs.map((log) => {
                        return {
                            msg: log.msg,
                            level: log.level,
                            dt: new Date(Number(log.timestamp)).toLocaleTimeString(),
                        };
                    });
                }
            })
            .catch((err: Error) => {
                this.log().error(`Fail fetch run data: ${err.message}`);
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
                if (!this.contentRef) {
                    return;
                }
                const links = this.contentRef.nativeElement.querySelectorAll('a');
                if (links === null) {
                    return;
                }
                links.forEach((link: HTMLAnchorElement) => {
                    link.addEventListener('click', this.redirect);
                });
            },
            unbind: (): void => {
                if (!this.contentRef) {
                    return;
                }
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
        this.load()
            .catch((err: Error) => {
                this.log().error(`Fail to load plugin's details: ${err.message}`);
            })
            .finally(() => {
                if (!this.plugin.isValid()) {
                    this.goto().inspect();
                }
            });
    }

    protected redirect(event: MouseEvent): void {
        dom.stop(event);
        // TODO: safe openening URL
    }

    constructor(
        cdRef: ChangeDetectorRef,
        protected readonly sanitizer: DomSanitizer,
    ) {
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

    public goto(): { readme(): void; inspect(): void } {
        return {
            readme: (): void => {
                this.tab = Tab.ReadMe;
                this.detectChanges();
                this.links().bind();
            },
            inspect: (): void => {
                this.links().unbind();
                this.tab = Tab.Inspecting;
                this.fetchRunData();
            },
        };
    }

    public async removePlugin(): Promise<void> {
        if (this.plugin.path === undefined) {
            return;
        }
        await this.provider.removePlugin(this.plugin.path.filename);
    }
}

export interface Details extends IlcInterface {}
