export interface GrabbedElementList {
    elements: GrabbedElement[];
}
export interface GrabbedElement {
    source_id: number;
    content: string;
    pos: number;
    nature: number;
}
