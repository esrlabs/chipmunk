export interface ProcessTransportSettings {
    command: string;
    cwd: string;
    args: string[];
    envs: { [key: string]: string };
}
