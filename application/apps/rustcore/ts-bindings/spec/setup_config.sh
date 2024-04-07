export JASMIN_TEST_CONFIGURATION="./spec/benchmarks.json"
export SH_HOME_DIR="/chipmunk"
if [ "$#" -gt 0 ]; then
    export PERFORMANCE_RESULTS_FOLDER="chipmunk_performance_results"
    export PERFORMANCE_RESULTS="Benchmark_$1.json"
else
    echo "No arguments provided."
fi