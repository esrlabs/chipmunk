export function basename(file: string): string {
    if (typeof file !== 'string') {
        return '';
    }
    const clean: string = file.trim().replace(/\/$/, '');
    const folder: string = clean.replace(/[^\/]*$/gi, '');
    const filename: string = clean.replace(folder, '');
    return filename;
}

export function dirname(file: string): string {
    if (typeof file !== 'string') {
        return '';
    }
    const clean: string = file.trim().replace(/\/$/, '');
    const folder: string = clean.replace(/[^\/]*$/gi, '');
    return folder;
}
