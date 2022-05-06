export interface JobEvent {
    uuid: string;
    progress: number;
    session?: string;
    desc?: string;
}
