
export enum EContextMenuItemTypes {
    item = 'item',
    divider = 'divider'
}

export interface IContextMenuItem{
    caption?: string,
    type: EContextMenuItemTypes,
    handler: Function,
    items?: Array<IContextMenuItem>
}

export interface IContextMenuEvent {
    x: number,
    y: number,
    cssClass?: string,
    items?: Array<IContextMenuItem>
}