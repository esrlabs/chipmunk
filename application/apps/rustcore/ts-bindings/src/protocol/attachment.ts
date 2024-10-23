export interface AttachmentInfoList {
    elements: AttachmentInfo[];
}
export interface AttachmentInfo {
    uuid: string;
    filepath: string;
    name: string;
    ext: string;
    size: number;
    mime: string;
    messages: number[];
}
