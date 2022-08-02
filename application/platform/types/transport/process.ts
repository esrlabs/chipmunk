export interface ProcessTransportSettings {
    command: string;
    cmd: string;
    args: string[];
    envs: { [key: string]: string };
}
