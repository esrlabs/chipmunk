export function stop(event: KeyboardEvent | MouseEvent): boolean {
    event.stopImmediatePropagation();
    event.stopPropagation();
    event.preventDefault();
    return false;
}
