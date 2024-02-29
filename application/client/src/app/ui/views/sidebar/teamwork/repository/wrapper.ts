import { Attachment } from '@platform/types/content';

export class Wrapped {
    public selected: boolean = false;
    constructor(public readonly attachment: Attachment) {}
    public select(): void {
        this.selected = true;
    }
    public unselect(): void {
        this.selected = false;
    }
    public toggle(): void {
        this.selected = !this.selected;
    }
    public equal(attachment: Attachment): boolean {
        return this.attachment.uuid === attachment.uuid;
    }
    public ext(ext: string): boolean {
        return this.attachment.extAsString().toLowerCase() === ext.toLowerCase();
    }
}
