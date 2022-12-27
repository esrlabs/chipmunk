export function stop(event: KeyboardEvent | MouseEvent | Event): boolean {
    if (event === undefined || event === null) {
        return false;
    }
    typeof event.stopImmediatePropagation === 'function' && event.stopImmediatePropagation();
    typeof event.stopPropagation === 'function' && event.stopPropagation();
    typeof event.preventDefault === 'function' && event.preventDefault();
    return false;
}

export function findParentByTag(
    target: HTMLElement | null | undefined,
    tag: string[],
): HTMLElement | undefined {
    tag = tag.map((t) => t.toLowerCase());
    if (target === null || target === undefined) {
        return undefined;
    }
    if (typeof target.tagName !== 'string') {
        return undefined;
    }
    const targetTag = target.tagName.toLowerCase();
    if (tag.includes(targetTag)) {
        return target;
    }
    if (targetTag === 'body') {
        return undefined;
    }
    return findParentByTag(target.parentNode as HTMLElement, tag);
}

export function isParent(target: HTMLElement, parent: HTMLElement): boolean {
    const candidate = findParentByTag(target, [parent.tagName]);
    return candidate === undefined ? false : candidate === parent;
}
