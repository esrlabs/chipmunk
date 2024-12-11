export type AttachmentList = AttachmentInfo[];
export interface AttachmentInfo {
    uuid: string;
    filepath: string;
    name: string;
    ext: string | null;
    size: number;
    mime: string | null;
    messages: number[];
}
