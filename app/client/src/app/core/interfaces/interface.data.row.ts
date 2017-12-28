class DataRow{
    str         : string            = '';
    render_str  : string            = '';
    filtered    : boolean           = true;
    requests    : Object            = {};
    match       : string            = '';
    matchReg    : boolean           = true;
    filters     : Object            = {};
    parsed      : any               = null
}
export { DataRow };
