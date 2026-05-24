In addition to search, `chipmunk` provides tools for analyzing metrics and numerical data. Regular expressions can extract values from logs and turn them into charts.

A key advantage of `chipmunk` is that chart performance is largely insensitive to data volume - it performs equally well when processing a few hundred values or several million.

### Charts from filters

The Charts tab can visualize enabled filters as histogram-like bars, making it easy to compare how often each filter matches across the log.

<p align="center">
  <video src="../assets/charts/charts_filters.mp4" controls muted loop playsinline width="100%"></video>
</p>

### Charts from captured values

Captured value charts help monitor how numeric values in logs change over time. They are useful for metrics such as latency, duration, counters, or measurements printed by live commands.

To create one, search with a regex that captures the numeric value in its first capture group, such as `time=([\d\.]{1,})`, then save the search as a chart. The chart updates as new matching values arrive.

<p align="center">
  <video src="../assets/charts/charts_dynamic.mp4" controls muted loop playsinline width="100%"></video>
</p>
