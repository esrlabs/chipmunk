import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Matcher } from '@matcher/matcher';
import * as regex from '@platform/env/regex';

const store: {
    sanitizer: DomSanitizer | undefined;
    matcher: Matcher;
} = {
    sanitizer: undefined,
    matcher: Matcher.new(),
};

export function getMatcher(): Matcher {
    return store.matcher;
}

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
    return str.replace(reg, (match): string => {
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

export function hasFocusedInput(): Promise<boolean> {
    return new Promise((resolve) => {
        setTimeout(() => {
            if (document.activeElement === null) {
                return resolve(false);
            }
            const tag: string = document.activeElement.tagName.toLowerCase();
            if (['input', 'textarea'].indexOf(tag) !== -1) {
                resolve(false);
            } else {
                resolve(true);
            }
        }, 50);
    });
}

export function syncHasFocusedInput(): boolean {
    if (document.activeElement === null) {
        return false;
    }
    const tag: string = document.activeElement.tagName.toLowerCase();
    if (['input', 'textarea'].indexOf(tag) !== -1) {
        return false;
    } else {
        return true;
    }
}
