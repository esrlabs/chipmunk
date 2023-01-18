export interface ProcessTransportSettings {
    command: string;
    cwd: string;
    envs: { [key: string]: string };
}
