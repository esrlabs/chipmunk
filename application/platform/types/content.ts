export interface IGrabbedContent {
    grabbed_elements: IGrabbedElement[];
}

/**
 * Output for @grabStreamChunk method of session
 * (application/apps/rustcore/ts/src/native/native.session.ts)
 */
export interface IGrabbedElement {
    source_id: string;
    content: string;
    position: number;
    row: number;
}
