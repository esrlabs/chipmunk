import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Columns } from '@schema/render/columns';

export interface Update {
    styles(): Update;
    content(content: string): Update;
    visability(): Update;
}
export class Cell {
    public content: string;
    public html!: SafeHtml;
    public styles: { [key: string]: string } = {};
    public visible: boolean = true;
    public readonly index: number;

    private readonly _sanitizer: DomSanitizer;
    private readonly _controller: Columns;

    constructor(sanitizer: DomSanitizer, controller: Columns, content: string, index: number) {
        this._sanitizer = sanitizer;
        this._controller = controller;
        this.content = content;
        this.index = index;
        this.update().content(content).visability().styles();
    }

    public update(): Update {
        const update = {
            styles: (): Update => {
                this.styles = this._controller.getStyle(this.index);
                return update;
            },
            content: (content: string): Update => {
                if (this.content === content && this.html !== undefined) {
                    return update;
                }
                this.content = content;
                this.html = this._sanitizer.bypassSecurityTrustHtml(content);
                return update;
            },
            visability: (): Update => {
                this.visible = this._controller.visible(this.index);
                return update;
            },
        };
        return update;
    }
}
