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
    nature: Nature[];
}

export enum IndexingMode {
    Regular = 0,
    Breadcrumbs = 1,
    Selection = 2,
}

export enum Nature {
    Search = 0,
    Bookmark = 1,
    Selection = 2,
    Breadcrumb = 3,
    BreadcrumbSeporator = 4,
}
