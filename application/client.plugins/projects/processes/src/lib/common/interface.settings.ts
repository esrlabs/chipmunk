export interface IForkSettings {
    env: { [key: string]: string };
    shell: string | boolean;
    cwd: string;
}
