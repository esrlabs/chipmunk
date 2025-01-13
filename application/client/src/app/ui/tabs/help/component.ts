import {
    Component,
    ChangeDetectorRef,
    AfterViewInit,
    ViewChild,
    ElementRef,
    ViewEncapsulation,
    Input,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { micromark } from 'micromark';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import * as dom from '@ui/env/dom';

const HOME = `/readme.md`;
const PATH = `assets/documentation`;

@Component({
    selector: 'app-tabs-help',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None,
    standalone: false,
})
@Initial()
@Ilc()
export class Help extends ChangesDetector implements AfterViewInit {
    @Input() location: string | undefined;
    @ViewChild('content') contentRef!: ElementRef<HTMLElement>;
    @ViewChild('index') indexRef!: ElementRef<HTMLElement>;

    protected paths: {
        index: string;
        content: string;
        location: string;
    } = {
        index: '/readme.md',
        content: '/features.md',
        location: '',
    };
    protected history: string[] = [];

    protected url(): {
        clean(path: string): string;
        src(html: string): string;
    } {
        return {
            clean: (path: string): string => {
                return path.replace(/^\./gi, '');
            },
            src: (html: string): string => {
                return html.replace(/src="(.*?)"/gi, (_match: string, url: string) => {
                    if (typeof url !== 'string') {
                        return 'src=""';
                    }
                    return `src="${PATH}/${this.paths.location}${url}"`;
                });
            },
        };
    }
    protected fetch(): {
        index(): Promise<void>;
        content(): Promise<void>;
        all(): void;
    } {
        const load = (dest: string): Promise<SafeHtml> => {
            return new Promise((resolve) => {
                fetch(dest)
                    .then((res) => {
                        if (res.status !== 200) {
                            return;
                        }
                        res.text().then((markdown) => {
                            const lines = markdown.split(/[\n\r]/gi);
                            const indexes: { found: boolean; count: number } = {
                                found: false,
                                count: -1,
                            };
                            lines.forEach((line: string, i: number) => {
                                if (indexes.found && indexes.count !== -1) {
                                    return;
                                }
                                if (!indexes.found && line.toLowerCase() === '## content') {
                                    indexes.found = true;
                                }
                                if (indexes.found && i > 1 && line.trim().startsWith('#')) {
                                    indexes.count = i;
                                }
                            });
                            if (indexes.found && indexes.count !== -1) {
                                lines.splice(0, indexes.count);
                            }
                            resolve(
                                this.sanitizer.bypassSecurityTrustHtml(
                                    this.url().src(micromark(lines.join('\n'))),
                                ),
                            );
                        });
                    })
                    .catch((err) => {
                        this.log().error(err);
                    });
            });
        };
        return {
            index: (): Promise<void> => {
                return load(`${PATH}${this.url().clean(this.paths.index)}`)
                    .then((html) => {
                        this.html.index = html;
                        this.detectChanges();
                        this.bind().index();
                    })
                    .catch((err: Error) => {
                        this.log().error(`Fail to get HTML of index: ${err.message}`);
                    });
            },
            content: (): Promise<void> => {
                return load(`${PATH}${this.url().clean(this.paths.content)}`)
                    .then((html) => {
                        this.html.content = html;
                        this.detectChanges();
                        this.bind().content();
                    })
                    .catch((err: Error) => {
                        this.log().error(`Fail to get HTML of content: ${err.message}`);
                    });
            },
            all: (): void => {
                Promise.allSettled([this.fetch().index(), this.fetch().content()])
                    .catch((err: Error) => {
                        this.log().error(`Fail to get HTML: ${err.message}`);
                    })
                    .finally(() => {
                        if (this.location !== undefined) {
                            this.link(this.location, false);
                        }
                    });
            },
        };
    }

    protected bind(): {
        content(): void;
        index(): void;
    } {
        return {
            content: (): void => {},
            index: (): void => {
                const links = this.indexRef.nativeElement.querySelectorAll('a');
                if (links === null) {
                    return;
                }
                links.forEach((link: HTMLAnchorElement) => {
                    link.addEventListener('click', this.redirect);
                });
            },
        };
    }

    protected unbind(): {
        content(): void;
        index(): void;
    } {
        return {
            content: (): void => {},
            index: (): void => {
                const links = this.indexRef.nativeElement.querySelectorAll('a');
                if (links === null) {
                    return;
                }
                links.forEach((link: HTMLAnchorElement) => {
                    link.removeEventListener('click', this.redirect);
                });
            },
        };
    }

    protected redirect(event: MouseEvent): void {
        dom.stop(event);
        this.link((event.target as HTMLAnchorElement).href);
    }

    protected link(url: string, track: boolean = true): void {
        url = `/${url.replace(/^.*\/client\//gi, '')}`;
        if (url.toLowerCase().endsWith(`/readme.md`)) {
            this.paths.location = url.replace(/readme\.md$/gi, '');
            track && this.history.push(this.paths.index);
            this.paths.index = url;
            this.unbind().index();
            this.fetch()
                .index()
                .then(() => {
                    const links = this.indexRef.nativeElement.querySelectorAll('a');
                    if (links === null) {
                        return;
                    }
                    this.link(links[0].href);
                })
                .catch((err: Error) => {
                    this.log().error(`Fail to update index: ${err.message}`);
                });
        } else {
            this.paths.content = `${this.paths.location}${url}`;
            this.unbind().content();
            this.fetch().content();
        }
    }

    public html: {
        index: SafeHtml;
        content: SafeHtml;
    } = {
        index: '',
        content: '',
    };

    constructor(cdRef: ChangeDetectorRef, protected readonly sanitizer: DomSanitizer) {
        super(cdRef);
        this.redirect = this.redirect.bind(this);
    }

    public ngAfterViewInit(): void {
        this.fetch().all();
    }

    public home(): void {
        this.link(HOME);
    }

    public back(): void {
        if (this.history.length === 0) {
            return;
        }
        this.link(this.history.splice(this.history.length - 1, 1)[0], false);
    }
}
export interface Help extends IlcInterface {}
