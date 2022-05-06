import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import * as regex from '@platform/env/regex';

const store: {
    sanitizer: DomSanitizer | undefined;
} = {
    sanitizer: undefined,
};

export function getDomSanitizer(): DomSanitizer {
    if (store.sanitizer === undefined) {
        throw new Error(`No DomSanitizer has been setup`);
    }
    return store.sanitizer;
}

export function setDomSanitizer(sanitizer: DomSanitizer): void {
    if (store.sanitizer !== undefined) {
        throw new Error(`DomSanitizer has been setup already`);
    }
    store.sanitizer = sanitizer;
}

export function wrapMatchesToHtml(matcher: string, str: string, tag: string = 'span'): string {
    if (matcher === '') {
        return str;
    }
    const reg = regex.fromStr(matcher);
    if (reg instanceof Error) {
        return str;
    }
    return str.replace(reg, (match, _p1, _p2, _p3, _offset, _string): string => {
        return `<${tag}>${match}</${tag}>`;
    });
}

export function wrapMatchesToSafeHtml(
    matcher: string,
    str: string,
    tag: string = 'span',
): SafeHtml {
    return getDomSanitizer().bypassSecurityTrustHtml(wrapMatchesToHtml(matcher, str, tag));
}
