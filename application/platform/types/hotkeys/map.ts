export enum Category {
    Files = 'Files',
    Focus = 'Focus',
    Tabs = 'Tabs',
    Movement = 'Movement',
    Areas = 'Areas',
    Search = 'Search',
    Other = 'Other',
}

export enum Requirement {
    Session = 'Session',
    NoInput = 'NoInput',
}

export interface Binding {
    shift?: boolean;
    ctrl?: boolean;
    alt?: boolean;
    // Should be TRUE for all keys, which are in coflict with collectable keys.
    // For example, postpined = true for key 'g', because we have also key 'gg'.
    postponed?: boolean;
    key: string | string[];
}

export interface KeyDescription {
    alias: string;
    shortkeys: {
        darwin?: string[];
        others: string[];
    };
    description: string;
    category: Category;
    required: Requirement[];
    uuid: string;
    // true - listener is on browser layer; false - listener on holder(electron)
    client: Binding | Binding[] | undefined;
}

export const KeysMap: KeyDescription[] = [
    // {
    //     alias: 'Ctrl + T',
    //     shortkeys: { darwin: ['⌘ + T'], others: ['Ctrl + T'] },
    //     description: 'Open new tab',
    //     category: Category.Tabs,
    //     required: [],
    //     uuid: 'Ctrl + T',
    //     client: undefined,
    // },
    {
        alias: 'Ctrl + W',
        shortkeys: { darwin: ['⌘ + W'], others: ['Ctrl + W'] },
        description: 'Close active tab',
        category: Category.Tabs,
        required: [],
        uuid: 'Ctrl + W',
        client: undefined,
    },
    {
        alias: 'Ctrl + Tab',
        shortkeys: { darwin: ['⌘ + Tab'], others: ['Ctrl + Tab'] },
        description: 'Next tab',
        category: Category.Tabs,
        required: [],
        uuid: 'Ctrl + Tab',
        client: undefined,
    },
    {
        alias: 'Shift + Ctrl + Tab',
        shortkeys: { darwin: ['Shift + ⌘ + Tab'], others: ['Shift + Ctrl + Tab'] },
        description: 'Previous tab',
        category: Category.Tabs,
        required: [],
        uuid: 'Shift + Ctrl + Tab',
        client: undefined,
    },
    {
        alias: 'Ctrl + P',
        shortkeys: { darwin: ['⌘ + P'], others: ['Ctrl + P'] },
        description: 'Open recent files',
        category: Category.Files,
        required: [],
        uuid: 'Ctrl + P',
        client: undefined,
    },
    {
        alias: 'Shift + Ctrl + P',
        shortkeys: { darwin: ['Shift + ⌘ + P'], others: ['Shift + Ctrl + P'] },
        description: 'Open recent filters and presets',
        category: Category.Files,
        required: [Requirement.Session],
        uuid: 'Shift + Ctrl + P',
        client: undefined,
    },
    {
        alias: 'Ctrl + O',
        shortkeys: { darwin: ['⌘ + O'], others: ['Ctrl + O'] },
        description: 'Recent actions (Home)',
        category: Category.Files,
        required: [],
        uuid: 'Ctrl + O',
        client: undefined,
    },
    // {
    //     alias: 'Shift + Ctrl + F',
    //     shortkeys: { darwin: ['Shift + ⌘ + F'], others: ['Shift + Ctrl + F'] },
    //     description: 'Show filters tab',
    //     category: Category.Areas,
    //     required: [Requirement.Session],
    //     uuid: 'Shift + Ctrl + F',
    //     client: undefined,
    // },
    {
        alias: '[',
        shortkeys: { others: ['['] },
        description: 'Select previous match row',
        category: Category.Movement,
        required: [Requirement.NoInput, Requirement.Session],
        uuid: '[',
        client: { key: '[' },
    },
    {
        alias: ']',
        shortkeys: { others: [']'] },
        description: 'Select next match row',
        category: Category.Movement,
        required: [Requirement.NoInput, Requirement.Session],
        uuid: ']',
        client: { key: ']' },
    },
    {
        alias: 'j',
        shortkeys: { others: ['j'] },
        description: 'Select next bookmarked row',
        category: Category.Movement,
        required: [Requirement.NoInput, Requirement.Session],
        uuid: 'j',
        client: { key: 'j' },
    },
    {
        alias: 'k',
        shortkeys: { others: ['k'] },
        description: 'Select previous bookmarked row',
        category: Category.Movement,
        required: [Requirement.NoInput, Requirement.Session],
        uuid: 'k',
        client: { key: 'k' },
    },
    {
        alias: 'gg',
        shortkeys: { others: ['gg'] },
        description: 'Scroll to beginning of main output',
        category: Category.Movement,
        required: [Requirement.NoInput, Requirement.Session],
        uuid: 'gg',
        client: { key: ['g', 'g'] },
    },
    {
        alias: 'g',
        shortkeys: { others: ['g'] },
        description: 'Scroll to end of main output',
        category: Category.Movement,
        required: [Requirement.NoInput, Requirement.Session],
        uuid: 'g',
        client: { postponed: true, key: 'g' },
    },
    {
        alias: 'Ctrl + F',
        shortkeys: { darwin: ['⌘ + F', '/'], others: ['Ctrl + F', '/'] },
        description: 'Focus on search input',
        category: Category.Focus,
        required: [Requirement.Session],
        uuid: 'Ctrl + F',
        client: undefined,
    },
    {
        alias: 'Ctrl + 1',
        shortkeys: { darwin: ['⌘ + 1'], others: ['Ctrl + 1'] },
        description: 'Focus on main output',
        category: Category.Focus,
        required: [Requirement.Session],
        uuid: 'Ctrl + 1',
        client: undefined,
    },
    {
        alias: 'Ctrl + 2',
        shortkeys: { darwin: ['⌘ + 2'], others: ['Ctrl + 2'] },
        description: 'Focus on search results output',
        category: Category.Focus,
        required: [Requirement.Session],
        uuid: 'Ctrl + 2',
        client: undefined,
    },
    {
        alias: 'Ctrl + B',
        shortkeys: { darwin: ['⌘ + B'], others: ['Ctrl + B'] },
        description: 'Toggle sidebar',
        category: Category.Areas,
        required: [Requirement.Session],
        uuid: 'Ctrl + B',
        client: undefined,
    },
    {
        alias: 'Ctrl + J',
        shortkeys: { darwin: ['⌘ + J'], others: ['Ctrl + J'] },
        description: 'Toggle toolbar',
        category: Category.Areas,
        required: [Requirement.Session],
        uuid: 'Ctrl + J',
        client: undefined,
    },
    // {
    //     alias: 'Ctrl + ,',
    //     shortkeys: { darwin: ['⌘ + ,'], others: ['Ctrl + ,'] },
    //     description: 'Show settings',
    //     category: Category.Other,
    //     required: [],
    //     uuid: 'Ctrl + ,',
    //     client: undefined,
    // },
    {
        alias: '?',
        shortkeys: { others: ['?'] },
        description: 'Show this dialog',
        category: Category.Other,
        required: [Requirement.NoInput],
        uuid: '?',
        client: { key: '?' },
    },
];

export function getKeyByUuid(uuid: string): KeyDescription | undefined {
    return KeysMap.find((k) => k.uuid === uuid);
}

export function getKeyByAlias(alias: string): KeyDescription | undefined {
    return KeysMap.find((k) => k.alias === alias);
}
