interface Request{
    GUID            : string,
    value           : string,
    type            : string,
    foregroundColor : string,
    backgroundColor : string,
    active          : boolean,
    passive         : boolean,
    count           : number,
    visibility      : boolean,
    isDragOver?     : boolean
}

export { Request };
