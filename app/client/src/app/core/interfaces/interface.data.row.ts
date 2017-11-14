class DataRow{
    str         : string            = '';
    render_str  : string            = '';
    filtered    : boolean           = true;
    requests    : Object            = {};
    match       : string            = '';
    filters     : Object            = {};
    parsed      : any               = null
}
export { DataRow };
