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
    display: {
        darwin?: string[];
        others: string[];
    };
    description: string;
    category: Category;
    required: Requirement[];
    uuid: string;
    // Isn't visible in HotKeys popup
    hidden?: boolean;
    // true - listener is on browser layer; false - listener on holder(electron)
    client: Binding | Binding[] | undefined;
}
//⌘ key
export const KeysMap: KeyDescription[] = [
    {
        alias: 'Ctrl + T',
        shortkeys: { darwin: ['Cmd + T'], others: ['Ctrl + T'] },
        display: { darwin: ['⌘ + T'], others: ['Ctrl + T'] },
        description: 'Home',
        category: Category.Tabs,
        required: [],
        uuid: 'Ctrl + T',
        client: undefined,
    },
    {
        alias: 'Ctrl + W',
        shortkeys: { darwin: ['Cmd + W'], others: ['Ctrl + W'] },
        display: { darwin: ['⌘ + W'], others: ['Ctrl + W'] },
        description: 'Close active tab',
        category: Category.Tabs,
        required: [],
        uuid: 'Ctrl + W',
        client: undefined,
    },
    {
        alias: 'Ctrl + Tab',
        shortkeys: { darwin: ['Control + Tab'], others: ['Ctrl + Tab'] },
        display: { darwin: ['Control + Tab'], others: ['Ctrl + Tab'] },
        description: 'Next tab',
        category: Category.Tabs,
        required: [],
        uuid: 'Ctrl + Tab',
        client: undefined,
    },
    {
        alias: 'Shift + Ctrl + Tab',
        shortkeys: { darwin: ['Shift + Control + Tab'], others: ['Shift + Ctrl + Tab'] },
        display: { darwin: ['Shift + Control + Tab'], others: ['Shift + Ctrl + Tab'] },
        description: 'Previous tab',
        category: Category.Tabs,
        required: [],
        uuid: 'Shift + Ctrl + Tab',
        client: undefined,
    },
    {
        alias: 'Ctrl + P',
        shortkeys: { darwin: ['Cmd + P'], others: ['Ctrl + P'] },
        display: { darwin: ['⌘ + P'], others: ['Ctrl + P'] },
        description: 'Explore files in favorites',
        category: Category.Files,
        required: [],
        uuid: 'Ctrl + P',
        client: undefined,
    },
    {
        alias: 'Shift + Ctrl + P',
        shortkeys: { darwin: ['Shift + Cmd + P'], others: ['Shift + Ctrl + P'] },
        display: { darwin: ['Shift + ⌘ + P'], others: ['Shift + Ctrl + P'] },
        description: 'Show filter(s)/chart(s) presets',
        category: Category.Search,
        required: [Requirement.Session],
        uuid: 'Shift + Ctrl + P',
        client: undefined,
    },
    {
        alias: 'Ctrl + O',
        shortkeys: { darwin: ['Cmd + O'], others: ['Ctrl + O'] },
        display: { darwin: ['⌘ + O'], others: ['Ctrl + O'] },
        description: 'Recent actions (Home)',
        category: Category.Files,
        required: [],
        uuid: 'Ctrl + O',
        client: undefined,
    },
    {
        alias: '[',
        shortkeys: { others: ['['] },
        display: { others: ['['] },
        description: 'Select previous match row',
        category: Category.Movement,
        required: [Requirement.NoInput, Requirement.Session],
        uuid: '[',
        client: { key: '[' },
    },
    {
        alias: ']',
        shortkeys: { others: [']'] },
        display: { others: [']'] },
        description: 'Select next match row',
        category: Category.Movement,
        required: [Requirement.NoInput, Requirement.Session],
        uuid: ']',
        client: { key: ']' },
    },
    {
        alias: 'j',
        shortkeys: { others: ['j'] },
        display: { others: ['j'] },
        description: 'Select next bookmarked row',
        category: Category.Movement,
        required: [Requirement.NoInput, Requirement.Session],
        uuid: 'j',
        client: { key: 'j' },
    },
    {
        alias: 'k',
        shortkeys: { others: ['k'] },
        display: { others: ['k'] },
        description: 'Select previous bookmarked row',
        category: Category.Movement,
        required: [Requirement.NoInput, Requirement.Session],
        uuid: 'k',
        client: { key: 'k' },
    },
    {
        alias: 'gg',
        shortkeys: { others: ['gg'] },
        display: { others: ['gg'] },
        description: 'Scroll to beginning of main output',
        category: Category.Movement,
        required: [Requirement.NoInput, Requirement.Session],
        uuid: 'gg',
        client: { key: ['g', 'g'] },
    },
    {
        alias: 'G',
        shortkeys: { others: ['G'] },
        display: { others: ['G'] },
        description: 'Scroll to end of main output',
        category: Category.Movement,
        required: [Requirement.NoInput, Requirement.Session],
        uuid: 'G',
        client: { postponed: true, key: 'G' },
    },
    {
        alias: 'Ctrl + F',
        shortkeys: { darwin: ['Cmd + F', '/'], others: ['Ctrl + F', '/'] },
        display: { darwin: ['⌘ + F', '/'], others: ['Ctrl + F', '/'] },
        description: 'Focus on search input',
        category: Category.Focus,
        required: [Requirement.Session],
        uuid: 'Ctrl + F',
        client: undefined,
    },
    {
        alias: 'Ctrl + 1',
        shortkeys: { darwin: ['Cmd + 1'], others: ['Ctrl + 1'] },
        display: { darwin: ['⌘ + 1'], others: ['Ctrl + 1'] },
        description: 'Focus on main output',
        category: Category.Focus,
        required: [Requirement.Session],
        uuid: 'Ctrl + 1',
        client: undefined,
    },
    {
        alias: 'Ctrl + 2',
        shortkeys: { darwin: ['Cmd + 2'], others: ['Ctrl + 2'] },
        display: { darwin: ['⌘ + 2'], others: ['Ctrl + 2'] },
        description: 'Focus on search results output',
        category: Category.Focus,
        required: [Requirement.Session],
        uuid: 'Ctrl + 2',
        client: undefined,
    },
    {
        alias: 'Ctrl + B',
        shortkeys: { darwin: ['Cmd + B'], others: ['Ctrl + B'] },
        display: { darwin: ['⌘ + B'], others: ['Ctrl + B'] },
        description: 'Toggle sidebar',
        category: Category.Areas,
        required: [Requirement.Session],
        uuid: 'Ctrl + B',
        client: undefined,
    },
    {
        alias: 'Ctrl + J',
        shortkeys: { darwin: ['Cmd + J'], others: ['Ctrl + J'] },
        display: { darwin: ['⌘ + J'], others: ['Ctrl + J'] },
        description: 'Toggle toolbar',
        category: Category.Areas,
        required: [Requirement.Session],
        uuid: 'Ctrl + J',
        client: undefined,
    },
    {
        alias: 'Ctrl + ,',
        shortkeys: { darwin: ['Cmd + ,'], others: ['Ctrl + ,'] },
        display: { darwin: ['⌘ + ,'], others: ['Ctrl + ,'] },
        description: 'Show settings',
        category: Category.Other,
        required: [],
        uuid: 'Ctrl + ,',
        client: undefined,
    },
    {
        alias: '?',
        shortkeys: { others: ['?'] },
        display: { others: ['?'] },
        description: 'Show this dialog',
        category: Category.Other,
        required: [Requirement.NoInput],
        uuid: '?',
        client: { key: '?' },
    },
    {
        alias: 'Ctrl + Q',
        shortkeys: { darwin: ['Cmd + Q'], others: ['Ctrl + Q'] },
        display: { darwin: ['⌘ + Q'], others: ['Ctrl + Q'] },
        description: 'Quit',
        category: Category.Other,
        required: [],
        uuid: 'Ctrl + Q',
        client: undefined,
    },
    // Hidden
    {
        alias: 'Ctrl + C',
        shortkeys: { darwin: ['Cmd + C'], others: ['Ctrl + C'] },
        display: { darwin: ['⌘ + C'], others: ['Ctrl + C'] },
        description: 'Copy to clipboard',
        category: Category.Other,
        required: [Requirement.NoInput],
        uuid: 'Ctrl + C',
        client: undefined,
        hidden: true,
    },
];

export function getKeyByUuid(uuid: string): KeyDescription | undefined {
    return KeysMap.find((k) => k.uuid === uuid);
}

export function getKeyByAlias(alias: string): KeyDescription | undefined {
    return KeysMap.find((k) => k.alias === alias);
}
