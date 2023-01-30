export interface IGrabbedContent {
    grabbed_elements: IGrabbedElement[];
}

/**
 * Output for @grabStreamChunk method of session
 * (application/apps/rustcore/ts/src/native/native.session.ts)
 */
export interface IGrabbedElement {
    source_id: number;
    content: string;
    position: number;
    nature: number;
}

export interface IGrabbedElementRender {
    source_id: number;
    content: string;
    position: number;
    nature: Nature;
}

export enum IndexingMode {
    Regular = 0,
    Breadcrumbs = 1,
}

export enum NatureTypes {
    Search = 0,
    Bookmark = 1,
    Breadcrumb = 2,
    BreadcrumbSeporator = 3,
}

export class Nature {
    static getBits(int: number, len: number): number[] {
        const bits = [];
        for (let i = len - 1; i > -1; --i) {
            bits.push(0x01 & (int >> i));
        }
        return bits;
    }

    protected readonly bits: number[];
    public readonly match: boolean;
    public readonly bookmark: boolean;
    public readonly breadcrumb: boolean;
    public readonly seporator: boolean;

    constructor(int: number) {
        this.bits = Nature.getBits(int, 8);
        this.match = this.isMatch();
        this.bookmark = this.isBookmark();
        this.breadcrumb = this.isBreadcrumb();
        this.seporator = this.isSeporator();
    }

    protected isMatch(): boolean {
        return this.bits[7] === 1;
    }

    protected isBookmark(): boolean {
        return this.bits[6] === 1;
    }

    protected isBreadcrumb(): boolean {
        return this.bits[1] === 1;
    }

    protected isSeporator(): boolean {
        return this.bits[0] === 1;
    }

    public getTypes(): NatureTypes[] {
        const types: NatureTypes[] = [];
        if (this.match) {
            types.push(NatureTypes.Search);
        }
        if (this.bookmark) {
            types.push(NatureTypes.Bookmark);
        }
        if (this.breadcrumb) {
            types.push(NatureTypes.Breadcrumb);
        }
        if (this.seporator) {
            types.push(NatureTypes.BreadcrumbSeporator);
        }
        return types;
    }
}

export function grabbedToRenderGrabbed(el: IGrabbedElement): IGrabbedElementRender {
    return {
        position: el.position,
        content: el.content,
        source_id: el.source_id,
        nature: new Nature(el.nature),
    };
}
