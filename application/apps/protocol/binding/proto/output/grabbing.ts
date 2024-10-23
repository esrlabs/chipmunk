export interface GrabbedElement {
    source_id: number;
    content: string;
    pos: number;
    nature: number;
}
export interface GrabbedElementList {
    elements: GrabbedElement[];
}
