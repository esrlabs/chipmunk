
export enum EContextMenuItemTypes {
    item = 'item',
    divider = 'divider'
}

export interface IContextMenuItem{
    caption?: string,
    color?: string,
    type: EContextMenuItemTypes,
    handler?: Function,
    items?: Array<IContextMenuItem>
}

export interface IContextMenuEvent {
    x: number,
    y: number,
    cssClass?: string,
    items?: Array<IContextMenuItem>
}