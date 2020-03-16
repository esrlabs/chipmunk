import { EHotkeyActionRef } from './hotkey';

export interface IHotkeyLocalCall {
    unixtime: number;
    shortcut: string;
    action: EHotkeyActionRef | string;
}
export class HotkeyLocalCall {

    public static Actions = EHotkeyActionRef;
    public static signature: string = 'HotkeyLocalCall';
    public signature: string = HotkeyLocalCall.signature;
    public action: EHotkeyActionRef | string;
    public shortcut: string;
    public unixtime: number;

    constructor(params: IHotkeyLocalCall) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for HotkeyLocalCall message`);
        }
        this.action = params.action;
        this.shortcut = params.shortcut;
        this.unixtime = params.unixtime;
    }

}
