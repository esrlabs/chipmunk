export interface IReader {
    read: (description: string, str: string) => Promise<void>;
}