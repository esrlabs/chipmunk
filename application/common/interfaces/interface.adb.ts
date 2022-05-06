export interface IAdbDevice {
    name: string;
    type: string;
}

export interface IAdbProcess {
    user: string;
    pid: number | undefined;
    ppid: number | undefined;
    vsz: number | undefined;
    rss: number | undefined;
    wchan: number | undefined;
    addr: number | undefined;
    s: string;
    name: string;
}

export interface IAdbSession {
    devices: IAdbDevice[];
    processes: IAdbProcess[];
    device: string | undefined;
    pid: number | undefined;
    logLevel: string;
    recieved: number;
}