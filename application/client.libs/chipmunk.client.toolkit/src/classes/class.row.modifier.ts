export enum EType {
    above = 'above', // 0 - Absolute priority
    match = 'match', // 1 - Major
    breakable = 'breakable', // 2 - Can be ignored. This is ASCI for example
    advanced = 'advanced', // 2.
}

export const Priorities = [EType.above, EType.match, EType.breakable];

export interface IRequest {
    reg: RegExp;
    color: string | undefined;
    background: string | undefined;
}

export interface IModifierRange {
    start: number;
    end: number;
}

export enum EHTMLInjectionType {
    close = 'close',
    open = 'open',
}

export enum EApplyTo {
    all = 'all',
    output = 'output',
    search = 'search',
}

export interface IHTMLInjection {
    offset: number;
    injection: string;
    type: EHTMLInjectionType;
}

export abstract class Modifier {
    public static Signature: string = 'modifier';

    public abstract getInjections(): IHTMLInjection[];

    public abstract obey(ranges: Array<Required<IModifierRange>>): void;

    public abstract getRanges(): Array<Required<IModifierRange>>;

    public abstract type(): EType;

    public abstract getGroupPriority(): number;

    public abstract finalize(str: string): string;

    public abstract getName(): string;

    public applyTo(): EApplyTo {
        return EApplyTo.all;
    }

    public signature(): string {
        return Modifier.Signature;
    }
}
