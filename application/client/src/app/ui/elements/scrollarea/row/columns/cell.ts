import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Columns } from '@schema/render/columns';

export class Cell {
    public content: string;
    public html: SafeHtml;
    public readonly index: number;

    private readonly _sanitizer: DomSanitizer;
    private readonly _controller: Columns;

    constructor(sanitizer: DomSanitizer, controller: Columns, content: string, index: number) {
        this._sanitizer = sanitizer;
        this._controller = controller;
        this.content = content;
        this.index = index;
        this.html = this._sanitizer.bypassSecurityTrustHtml(content);
    }

    public update(content: string) {
        this.content = content;
        this.html = this._sanitizer.bypassSecurityTrustHtml(content);
    }

    public styles(): { [key: string]: string } {
        const width = this._controller.getWidth(this.index);
        return width === undefined
            ? {}
            : {
                  width: `${width}px`,
              };
    }

    public visible(): boolean {
        return this._controller.visible(this.index);
    }
}
