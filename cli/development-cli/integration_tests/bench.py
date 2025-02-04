"""
Provides methods to test the Benchmark command in Chipmunk Build CLI Tool.
"""

from utls import get_root, run_command, print_green_bold, print_blue_bold


# We can only list the benchmarks since this command will test loading the benchmarks from the configuration file.
# Running the actual benchmarks will take too much time and it will be tedious to keep the benchmarks between
# this script and the configuration file in sync.
BENCH_LIST_COMMAND = [
    "cargo",
    "run",
    "-r",
    "--",
    "chipmunk",
    "bench",
    "list",
]


def run_benchmark_command():
    """
    Runs benchmark command for Chipmunk.
    This command will list the available tests only, loading the configuration of all benchmarks.
    """

    print_blue_bold("Running Benchmark Command...")

    run_command(BENCH_LIST_COMMAND)

    print_green_bold("*** Check for Benchmark Command Succeeded ***")


if __name__ == "__main__":
    run_benchmark_command()
