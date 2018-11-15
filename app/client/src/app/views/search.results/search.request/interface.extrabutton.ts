export interface ExtraButton {
    id              : string | symbol,
    title           : string,
    caption         : string,
    icon            : string,
    active          : boolean,
    placeholder     : string,
    onKeyUp         : Function,
    onEnter         : Function,
    onDropHistory   : Function,
    getHistory      : Function,
};

export interface BarAPI{
    setValue: Function,
    setState: Function,
    showProgress: Function,
    hideProgress: Function,
    setHistory: Function,
    disable: Function,
    enable: Function
}