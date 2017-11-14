import { ChartData, ChartDataItem } from './interface.chart.data';

const SETTINGS = {
    ON_SELECT_OFFSET        : 0.1,
    MINIMAL_SELECTION_WIDTH : 10
};

class D3Controller{

    private svg         : any       = null;
    private ready       : boolean   = false;
    private d3          : any       = null;
    private data        : any       = null;
    private textColors  : any       = null;
    private lineColors  : any       = null;

    private src : {
        start   : any,
        end     : any,
    } = {
        start   : null,
        end     : null,
    };

    private size : {
        margin  : any,
        margin2 : any,
        width   : any,
        height  : any,
        height2 : any,
    } = {
        margin  : null,
        margin2 : null,
        width   : null,
        height  : null,
        height2 : null,
    };

    private axis : {
        x       : any,
        x2      : any,
        y       : any,
        y2      : any,
        xAxis   : any,
        xAxis2  : any,
        yAxis   : any,
        z       : any
    } = {
        x       : null,
        x2      : null,
        y       : null,
        y2      : null,
        xAxis   : null,
        xAxis2  : null,
        yAxis   : null,
        z       : null
    };

    private tools : {
        viewport    : any,
        zoom        : any,
        area        : any,
        area2       : any,
        focus       : any,
        context     : any,
        clip        : any,
        range       : any
    } = {
        viewport    : null,
        zoom        : null,
        area        : null,
        area2       : null,
        focus       : null,
        context     : null,
        clip        : null,
        range       : null
    };

    constructor(private selector: string, private onSelect: Function){
        this.d3 = window['d3'];
        this.init();
    }

    init(){
        this.svg            = this.svg !== null ? this.svg : this.d3.select(this.selector);
        this.size.margin    = {top: 10, right: 20, bottom: 200, left: 20};
        this.size.margin2   = {top: 460, right: 20, bottom: 20, left: 20};
        this.size.width     = +this.svg.attr("width") - this.size.margin.left - this.size.margin.right;
        //this.size.height    = +this.svg.attr("height") - this.size.margin.top - this.size.margin.bottom;
        //this.size.height2   = +this.svg.attr("height") - this.size.margin2.top - this.size.margin2.bottom;
        this.size.height    = +(this.svg.attr("height") * 0.7 - 10);
        this.size.height2   = +(this.svg.attr("height") * 0.3 - 60);
        this.size.margin2.top = this.size.height + 30;
        if (this.size.height > 0 && !isNaN(this.size.height) && this.size.width > 0 && !isNaN(this.size.width) && !this.ready){
            this.axis.x         = this.d3.scaleTime().range([0, this.size.width]);
            this.axis.x2        = this.d3.scaleTime().range([0, this.size.width]);
            this.axis.y         = this.d3.scaleLinear().range([this.size.height, 0]);
            this.axis.y2        = this.d3.scaleLinear().range([this.size.height2, 0]);
            this.axis.z         = this.d3.scaleOrdinal(this.d3.schemeCategory10);

            this.axis.xAxis     = this.d3.axisBottom(this.axis.x);
            this.axis.xAxis2    = this.d3.axisBottom(this.axis.x2);
            this.axis.yAxis     = this.d3.axisLeft(this.axis.y);

            this.tools.viewport = this.d3.brushX()
                .extent([[0, 0], [this.size.width, this.size.height2]])
                .on("brush", this.onViewPort.bind(this));

            this.tools.zoom     = this.d3.zoom()
                .scaleExtent([1, 60000])
                .translateExtent([[0, 0], [this.size.width, this.size.height]])
                .extent([[0, 0], [this.size.width, this.size.height]])
                .on("zoom", this.zoomed.bind(this));

            this.tools.area     = this.d3.line()
                .x(function(d : any) {
                    return this.axis.x(d.datetime);
                }.bind(this))
                .y(function(d : ChartDataItem) {
                    return this.axis.y(d.value);
                }.bind(this));

            this.tools.area2    = this.d3.line()
                .x(function(d : ChartDataItem) {
                    return this.axis.x2(d.datetime);
                }.bind(this))
                .y(function(d : ChartDataItem) {
                    return this.axis.y2(d.value);
                }.bind(this));
            this.append();
            this.tools.range    = this.axis.x.range();
            this.d3.select(this.selector).on('click', function(){
                typeof this.onSelect === 'function' && this.onSelect(this.axis.x.invert(this.d3.event.pageX));
            }.bind(this));
            return true;
        }
    }

    resize(){
        if (this.size.height > 0 && !isNaN(this.size.height) && this.size.width > 0 && !isNaN(this.size.width) && !this.ready) {
            this.size.margin        = {top: 10, right: 20, bottom: 200, left: 20};
            this.size.margin2       = {top: 460, right: 20, bottom: 20, left: 20};
            this.size.width         = +this.svg.attr("width") - this.size.margin.left - this.size.margin.right;
            this.size.height        = +(this.svg.attr("height") * 0.7 - 10);
            this.size.height2       = +(this.svg.attr("height") * 0.3 - 60);
            this.size.margin2.top   = this.size.height + 30;
            this.axis.x         .range([0, this.size.width]);
            this.axis.x2        .range([0, this.size.width]);
            this.axis.y         .range([this.size.height, 0]);
            this.axis.y2        .range([this.size.height2, 0]);
            this.tools.focus    .select("path.line")
                .attr("d", this.tools.area);
            this.tools.context  .select(".line")
                .attr("d", this.tools.area2);
            this.tools.context  .attr("transform", "translate(" + this.size.margin2.left + "," + this.size.margin2.top + ")");
            this.tools.context  .select(".axis--x")
                .attr("transform", "translate(0," + this.size.height2 + ")")
                .call(this.axis.xAxis2);
            this.tools.focus    .select(".axis--x")
                .attr("transform", "translate(0," + this.size.height + ")")
                .call(this.axis.xAxis);
            this.tools.clip     .attr("width", this.size.width)
                .attr("height", this.size.height);
            this.svg            .select('.zoom')
                .attr("width", this.size.width)
                .attr("height", this.size.height);
            this.tools.viewport .extent([[0, 0], [this.size.width, this.size.height2]]);
            this.tools.context  .select(".brush")
                .call(this.tools.viewport);
            this.tools.context  .select(".selection")
                .attr("height", this.size.height2);
            this.tools.context  .select(".handle")
                .attr("height", this.size.height2);
            this.labelsUpdate();
            if (this.tools.range !== null){
                let range = this.axis.x.range();
                this.tools.range[0] < range[0] && (this.tools.range[0] = range[0]);
                this.tools.range[1] > range[1] && (this.tools.range[1] = range[1]);
                this.tools.context.select(".brush").call(this.tools.viewport.move, this.tools.range);
            }
        }
    }

    destroy(){
        this.svg !== null && this.svg.selectAll('*').remove();
    }

    append(){
        this.tools.clip = this.svg.append("defs").append("clipPath")
            .attr("id", "clip")
            .append("rect")
            .attr("width", this.size.width)
            .attr("height", this.size.height);

        this.tools.focus = this.svg.append("g")
            .attr("class", "focus")
            .attr("transform", "translate(" + this.size.margin.left + "," + this.size.margin.top + ")");

        this.tools.context = this.svg.append("g")
            .attr("class", "context")
            .attr("transform", "translate(" + this.size.margin2.left + "," + this.size.margin2.top + ")");
    }

    onData(src : ChartData){
        this.destroy();
        if (this.init()){
            this.data       = src.data;
            this.textColors = src.textColors;
            this.lineColors = src.lineColors;

            this.src.start  = src.start;
            this.src.end    = src.end;

            this.axis.x.    domain([src.start, src.end]);
            this.axis.y.    domain([src.min, src.max]);
            this.axis.x2.   domain(this.axis.x.domain());
            this.axis.y2.   domain(this.axis.y.domain());

            Object.keys(this.data).forEach((GUID)=>{
                this.createMainLine(GUID);
            });

            this.tools.focus.   append("g").
            attr("class", "axis axis--x").
            attr("transform", "translate(0," + this.size.height + ")").
            call(this.axis.xAxis);

            this.tools.context. append("g").
            attr("class", "axis axis--x").
            attr("transform", "translate(0," + this.size.height2 + ")").
            call(this.axis.xAxis2);

            Object.keys(this.data).forEach((GUID)=>{
                this.createZoomLine(GUID);
            });

            this.svg.           append("rect").
            attr("class", "zoom").
            attr("width", this.size.width).
            attr("height", this.size.height).
            attr("transform", "translate(" + this.size.margin.left + "," + this.size.margin.top + ")").
            call(this.tools.zoom);

            this.tools.context. append("g").
            attr("class", "brush").
            call(this.tools.viewport).
            call(this.tools.viewport.move, this.axis.x.range());
        }
    }

    createMainLine(GUID: string){
        let serie = this.tools.focus.   selectAll('.serie' + GUID).
                                        data([this.data[GUID]]).
                                        enter().
                                        append('g').
                                        attr('class', 'serie ' + GUID);

        serie.  append("path").
                attr("class", 'line ' + GUID).
                style("stroke", this.lineColors[GUID]).
                attr("d", this.tools.area);

        this.labelsRender(GUID, serie);
    }

    createZoomLine(GUID: string){
        let serie = this.tools.context. selectAll('.serie.'+ GUID).
                                        data([this.data[GUID]]).
                                        enter().
                                        append('g').
                                        attr('class', 'serie ' + GUID);

        serie.  append("path").
                attr("class", 'line ' + GUID).
                style("stroke", this.lineColors[GUID]).
                attr("d", this.tools.area2);
    }

    labelsRender(GUID: string, serie : any){
        let label = serie.  selectAll('.label.'+ GUID).
                            data(function(d:ChartDataItem) { return d; }).
                            enter().
                            append("g").
                            attr("class", 'label ' + GUID).
                            attr("transform", function(d:ChartDataItem, i: number) { return "translate(" + this.axis.x(d.datetime) + "," + this.axis.y(d.value) + ")"; }.bind(this));
        label.  append("text").
                style("stroke", this.textColors[GUID]).
                attr("dy", "-.15em").
                attr("dx", "-.60em").
                text(function(d:ChartDataItem) { return d.key; }).
                append("tspan").
                attr("class", "label-key");
    }

    labelsUpdate(){
        this.tools.focus.   selectAll('.label').
                            attr("transform", function(d:ChartDataItem, i: number) {
                                return "translate(" + this.axis.x(d.datetime) + "," + this.axis.y(d.value) + ")";
                            }.bind(this));
    }

    validateRange(range: Array<number>){
        return range;
    }

    correctSelectionRect(){
        let selection   = this.tools.context .select(".selection"),
            width       = selection.attr("width");
        selection.attr("width", (width < SETTINGS.MINIMAL_SELECTION_WIDTH ? SETTINGS.MINIMAL_SELECTION_WIDTH : width));
    }

    onViewPort(incomeSelection: Array<number>){
        if (incomeSelection instanceof Array || (!this.d3.event.sourceEvent || this.d3.event.sourceEvent.type !== "zoom")) {
            let selection = incomeSelection instanceof Array ? incomeSelection : (this.d3.event.selection || this.axis.x2.range());
            this.axis.x.domain(selection.map(this.axis.x2.invert, this.axis.x2));
            Object.keys(this.data).forEach((GUID: string)=>{
                this.tools.focus.select('.line.' + GUID).attr("d", this.tools.area);
            });
            this.tools.focus.select(".axis--x").call(this.axis.xAxis);
            let rate = this.size.width / (selection[1] - selection[0]);
            this.svg.select(".zoom").call(this.tools.zoom.transform, this.d3.zoomIdentity
                .scale(rate)
                .translate(-selection[0], 0));
            this.labelsUpdate();
            this.tools.range = this.validateRange(selection);
            this.correctSelectionRect();
        }
    }

    zoomed(){
        if (this.d3.event !== null && (!this.d3.event.sourceEvent || this.d3.event.sourceEvent.type !== "brush")) {
            let transform   = this.d3.event.transform,
                brushRange  = null;
            this.axis.x.domain(transform.rescaleX(this.axis.x2).domain());
            Object.keys(this.data).forEach((GUID: string)=>{
                this.tools.focus.select('path.line.' + GUID).attr("d", this.tools.area);
            });
            this.tools.focus.select(".axis--x").call(this.axis.xAxis);
            this.tools.range    = this.axis.x.range().map(transform.invertX, transform);
            this.tools.context.select(".brush").call(this.tools.viewport.move, this.validateRange(this.tools.range));
            this.labelsUpdate();
            this.correctSelectionRect();
        }
    }

    goToPosition(selected : Date){
        let range   = null,
            left    = null,
            right   = null;
        this.axis.x.domain([this.src.start, this.src.end]);
        selected.getTime() < this.src.start.getTime()   && (selected = this.src.start);
        selected.getTime() > this.src.end.getTime()     && (selected = this.src.end);
        range   = this.axis.x.range();
        left    = this.axis.x(selected);
        right   = range[1] * SETTINGS.ON_SELECT_OFFSET + left;
        if (right >= range[1]){
            right   = range[1];
            left    = right - range[1] * SETTINGS.ON_SELECT_OFFSET;
        }
        this.onViewPort([left, right]);
    }

}

export { D3Controller }
