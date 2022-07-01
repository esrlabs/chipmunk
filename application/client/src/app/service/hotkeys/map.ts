import { unique } from '@platform/env/sequence';

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
    shortkeys: string[];
    description: string;
    category: Category;
    binding: Binding;
    required: Requirement[];
    uuid: string;
}

export const KeysMap: KeyDescription[] = [
    {
        alias: 'Ctrl + T',
        shortkeys: ['⌘ + T', 'Ctrl + T'],
        description: 'Open new tab',
        category: Category.Tabs,
        binding: { ctrl: true, key: 't' },
        required: [],
        uuid: unique(),
    },
    {
        alias: 'Ctrl + W',
        shortkeys: ['⌘ + W', 'Ctrl + W'],
        description: 'Close active tab',
        category: Category.Tabs,
        binding: { ctrl: true, key: 'w' },
        required: [],
        uuid: unique(),
    },
    {
        alias: 'Ctrl + Tab',
        shortkeys: ['⌘ + Tab', 'Ctrl + Tab'],
        description: 'Next tab',
        category: Category.Tabs,
        binding: { ctrl: true, key: 'Tab' },
        required: [],
        uuid: unique(),
    },
    {
        alias: 'Shift + Ctrl + Tab',
        shortkeys: ['Shift + ⌘ + Tab', 'Shift + Ctrl + Tab'],
        description: 'Previous tab',
        category: Category.Tabs,
        binding: { ctrl: true, shift: true, key: 'Tab' },
        required: [],
        uuid: unique(),
    },
    {
        alias: 'Ctrl + P',
        shortkeys: ['⌘ + P', 'Ctrl + P'],
        description: 'Open recent files',
        category: Category.Files,
        binding: { ctrl: true, key: 'p' },
        required: [],
        uuid: unique(),
    },
    {
        alias: 'Shift + Ctrl + P',
        shortkeys: ['Shift + ⌘ + P', 'Shift + Ctrl + P'],
        description: 'Open recent filters',
        category: Category.Files,
        binding: { ctrl: true, shift: true, key: 'p' },
        required: [Requirement.Session],
        uuid: unique(),
    },
    {
        alias: 'Ctrl + O',
        shortkeys: ['⌘ + O', 'Ctrl + O'],
        description: 'Open local file',
        category: Category.Files,
        binding: { ctrl: true, key: 'o' },
        required: [],
        uuid: unique(),
    },
    {
        alias: 'Shift + Ctrl + F',
        shortkeys: ['Shift + ⌘ + F', 'Shift + Ctrl + F'],
        description: 'Show filters tab',
        category: Category.Areas,
        binding: { ctrl: true, shift: true, key: 'f' },
        required: [Requirement.Session],
        uuid: unique(),
    },
    {
        alias: '[',
        shortkeys: ['['],
        description: 'Select next match row',
        category: Category.Movement,
        binding: { ctrl: true, key: '[' },
        required: [Requirement.NoInput, Requirement.Session],
        uuid: unique(),
    },
    {
        alias: ']',
        shortkeys: [']'],
        description: 'Select previous match row',
        category: Category.Movement,
        binding: { ctrl: true, key: ']' },
        required: [Requirement.NoInput, Requirement.Session],
        uuid: unique(),
    },
    {
        alias: 'j',
        shortkeys: ['j'],
        description: 'Select next bookmarked row',
        category: Category.Movement,
        binding: { key: 'j' },
        required: [Requirement.NoInput, Requirement.Session],
        uuid: unique(),
    },
    {
        alias: 'k',
        shortkeys: ['k'],
        description: 'Select previous bookmarked row',
        category: Category.Movement,
        binding: { key: 'k' },
        required: [Requirement.NoInput, Requirement.Session],
        uuid: unique(),
    },
    {
        alias: 'gg',
        shortkeys: ['gg'],
        description: 'Scroll to beginning of main output',
        category: Category.Movement,
        binding: { key: ['g', 'g'] },
        required: [Requirement.NoInput, Requirement.Session],
        uuid: unique(),
    },
    {
        alias: 'g',
        shortkeys: ['g'],
        description: 'Scroll to end of main output',
        category: Category.Movement,
        binding: { postponed: true, key: 'g' },
        required: [Requirement.NoInput, Requirement.Session],
        uuid: unique(),
    },
    {
        alias: 'Ctrl + F',
        shortkeys: ['⌘ + F', 'Ctrl + F', '/'],
        description: 'Focus on search input',
        category: Category.Focus,
        binding: { ctrl: true, key: 'f' },
        required: [Requirement.Session],
        uuid: unique(),
    },
    {
        alias: 'Ctrl + 1',
        shortkeys: ['⌘ + 1', 'Ctrl + 1'],
        description: 'Focus on main output',
        category: Category.Focus,
        binding: { ctrl: true, key: '1' },
        required: [Requirement.Session],
        uuid: unique(),
    },
    {
        alias: 'Ctrl + 2',
        shortkeys: ['⌘ + 2', 'Ctrl + 2'],
        description: 'Focus on search results output',
        category: Category.Focus,
        binding: { ctrl: true, key: '2' },
        required: [Requirement.Session],
        uuid: unique(),
    },
    {
        alias: 'Ctrl + B',
        shortkeys: ['⌘ + B', 'Ctrl + B'],
        description: 'Toggle sidebar',
        category: Category.Areas,
        binding: { ctrl: true, key: 'b' },
        required: [Requirement.Session],
        uuid: unique(),
    },
    {
        alias: 'Ctrl + J',
        shortkeys: ['⌘ + J', 'Ctrl + J'],
        description: 'Toggle toolbar',
        category: Category.Areas,
        binding: { ctrl: true, key: 'j' },
        required: [Requirement.Session],
        uuid: unique(),
    },
    {
        alias: 'Ctrl + ,',
        shortkeys: ['⌘ + ,', 'Ctrl + ,'],
        description: 'Show settings',
        category: Category.Other,
        binding: { ctrl: true, key: ',' },
        required: [],
        uuid: unique(),
    },
    {
        alias: '?',
        shortkeys: ['?'],
        description: 'Show this dialog',
        category: Category.Other,
        binding: { key: '?' },
        required: [Requirement.NoInput],
        uuid: unique(),
    },
];

export function getKeyByUuid(uuid: string): KeyDescription | undefined {
    return KeysMap.find((k) => k.uuid === uuid);
}

export function getKeyByAlias(alias: string): KeyDescription | undefined {
    return KeysMap.find((k) => k.alias === alias);
}
