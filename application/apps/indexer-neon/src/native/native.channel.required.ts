// These methods should be present always with any channel from rust world
export type TPollCallback = (
    err: string | undefined | null,
    event: string | undefined | null,
    args: { [key: string]: any } | undefined | null,
) => void;

export abstract class RustChannelRequiered {
    public abstract poll(callback: TPollCallback): void;
    public abstract shutdown(): void;
}
