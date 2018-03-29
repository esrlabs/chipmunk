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
    isDragOver?     : boolean,
    dragInitialized?: boolean
}

interface Preset {
    name    : string,
    requests: Array<Request>
}

export { Request, Preset };
