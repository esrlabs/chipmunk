interface Settings{
    close?           : boolean,
    addCloseHandle?  : boolean,
    css?             : string,
    move?            : boolean,
    resize?          : boolean,
    width?           : string | number,
    height?          : string | number
}

export { Settings };