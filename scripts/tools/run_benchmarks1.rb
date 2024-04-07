require 'octokit'
require 'tmpdir'
require 'fileutils'

ENV['REPO_OWNER'] = 'esrlabs' if !ENV['REPO_OWNER']
ENV['REPO_NAME'] = 'chipmunk' if !ENV['REPO_NAME']

RAKE_COMMANDS = [
  'rake clobber',
  'rake bindings:build',
  'rake bindings:build_spec',
  'rake bindings:test:stream',
  'rake bindings:test:indexes',
  'rake bindings:test:search',
  'rake bindings:test:observe'
]

SHELL_SCRIPT_PATH = 'application/apps/rustcore/ts-bindings/spec'

if ARGV.length != 1
  puts "Usage: ruby scripts/tools/run_benchmarks.rb <number_of_releases>/<start_tag-end_tag>/PR~<PR_NUMBER>"
  exit(1)
end

def compute_average_of_benchmarks(result_path)
  # Read the JSON data from the file
  file_content = File.read(result_path)
  data = JSON.parse(file_content)

  # Group the tests by their names and compute the average actual value for each test type
  grouped_data = data.group_by { |test| test['name'] }
  puts "grouped_data is \n#{grouped_data}"

  averages = grouped_data.map do |name, tests|
    passed_tests = tests.select { |test| test['passed'] }

    if passed_tests.any?
      average_actual = passed_tests.sum { |test| test['actual'].to_f } / passed_tests.size
      average_expected = passed_tests.sum { |test| test['expectation'].to_f } / passed_tests.size
      { 'name' => name, 'actual' => average_actual, 'expectation' => average_expected, 'passed' => average_actual <= average_expected }
    else
      { 'name' => name, 'actual' => 0, 'expectation' => 0, 'passed' => false }
    end
  end

  puts "Final data is \n#{averages}"

  # Write the resulting JSON back to the file
  File.open(result_path, 'w') do |file|
    file.write(JSON.pretty_generate(averages))
  end
  puts "Average actual values have been written to the file #{result_path}"
end

client = Octokit::Client.new()

if ARGV[0].start_with?('PR~')
  pr_number = ARGV[0].split('~').last
  # Fetch the pull request by numbers
  pull_request = client.pull_request("esrlabs/chipmunk", pr_number)
  branch_name = pull_request.head.ref
  puts "Running benchmarks for the pull request: #{pull_request.title} (#{branch_name})"
else
  # Fetch the latest releases from the GitHub repository
  releases = client.releases("#{ENV['REPO_OWNER']}/#{ENV['REPO_NAME']}")

  if !ARGV[0] || (ARGV.length == 1 && ARGV[0].match?(/\A\d+(\.\d+)?\z/))
    NUMBER_OF_RELEASES = ARGV[0].to_i == 0 ? 1 : ARGV[0].to_i
    filtered_releases = releases.take(NUMBER_OF_RELEASES)
    puts "running benchmarks for last #{NUMBER_OF_RELEASES} releases"
  elsif ARGV.length == 1 && ARGV[0].include?('-')
    start_tag, end_tag = ARGV[0].split('-')
    if start_tag.nil? || end_tag.nil?
      puts "Invalid range format. Use <start_tag-end_tag>"
      exit(1)
    end
    filtered_releases = releases.select do |release|
      release.tag_name >= start_tag && release.tag_name <= end_tag
    end
    puts "running benchmarks for releases #{start_tag} - #{end_tag}"
  else
    puts "Usage: ruby scripts/tools/run_benchmarks.rb <number_of_releases>/<start_tag-end_tag>/PR~<PR_NUMBER>"
    exit(1)
  end
end

ENV_VARS = {
  'JASMIN_TEST_CONFIGURATION' => './spec/benchmarks.json',
  'PERFORMANCE_RESULTS_FOLDER' => 'chipmunk_performance_results',
  'PERFORMANCE_RESULTS' => '',
  'SH_HOME_DIR' => "/chipmunk"
  # 'SH_HOME_DIR' => "/Users/sameer.g.srivastava"
}

def process_release_or_pr(branch_or_tag_name, identifier)
  # Create a temporary directory for this release
  Dir.mktmpdir do |temp_dir|
    begin
      # Clone the repository into the temporary directory
      system("git clone --depth 1 --branch #{branch_or_tag_name} https://github.com/#{ENV['REPO_OWNER']}/#{ENV['REPO_NAME']}.git #{temp_dir}")

      # Copy scripts folder to have the test cases available in the cloned repo
      FileUtils.cp_r("#{SHELL_SCRIPT_PATH}/.", "#{temp_dir}/#{SHELL_SCRIPT_PATH}/.", verbose: true)
      FileUtils.cp_r("scripts/elements/bindings.rb", "#{temp_dir}/scripts/elements/bindings.rb", verbose: true)

      result_path = "#{ENV_VARS['SH_HOME_DIR']}/#{ENV_VARS['PERFORMANCE_RESULTS_FOLDER']}/Benchmark_#{identifier}.json"

      # Change directory to the temporary directory
      Dir.chdir(temp_dir) do
        # Execute the shell script
        ENV_VARS.each do |key, value|
          ENV[key] = "#{value}"
        end
        ENV['PERFORMANCE_RESULTS'] = "Benchmark_#{identifier}.json"
        system("corepack enable")
        system("yarn cache clean")

        if File.exist?("#{SHELL_SCRIPT_PATH}/#{ENV_VARS['JASMIN_TEST_CONFIGURATION'].gsub('./spec/', '')}")
          puts "Benchmark.json file available."
        else
          break
        end

        system("printenv")

        if File.exist?(result_path)
          FileUtils.rm(result_path, verbose: true)
        end

        # Run each Rake command
        RAKE_COMMANDS.each do |command|
          puts "Running #{command} for #{identifier}"
          system(command)
        end
      end

    rescue => e
      puts "An error occurred while processing #{identifier}: #{e.message}"
    end

    if File.exist?(result_path)
      compute_average_of_benchmarks(result_path)
      puts "Benchmark results:"
      system("cat #{result_path}")
    else
      puts "Benchmark results not found at #{result_path}."
    end
    puts "Completed processing #{identifier}"

  end
end

if ARGV[0].start_with?('PR~')
  process_release_or_pr(branch_name, "PR_#{pr_number}")
else
  # Iterate over the specified number of releases
  filtered_releases.each_with_index do |release, index|
    process_release_or_pr(release.tag_name, release.tag_name)
  end
end

# Method to read and parse JSON files
def read_benchmark_data(file_path)
  puts "Data in file = #{file_path}\n#{File.read(file_path)}\n:: EOF"
  { file_name: File.basename(file_path), data: JSON.parse(File.read(file_path)) }
end

# Method to collect data from the latest 10 JSON files
def collect_latest_benchmark_data(directory)
  Dir.glob("#{directory}/Benchmark_*.json").reject { |file| File.basename(file).start_with?('Benchmark_PR') }.map do |file|
    read_benchmark_data(file)
  end
end

# Method to generate graphs for each performance test type
def update_performance_data(data)
  # Hash to store data organized by test name
  test_data = {}

  # Collect data by test name
  data.each do |benchmark|
    benchmark[:data].each do |entry|
      test_name = entry['name']
      actual_value = entry['actual']
      file_name = benchmark[:file_name]

      if test_data[test_name]
        test_data[test_name] << { release: file_name.gsub("Benchmark_","").gsub(".json",""), actual_value: actual_value }
      else
        test_data[test_name] = [{ release: file_name.gsub("Benchmark_","").gsub(".json",""), actual_value: actual_value }]
      end
    end
  end

  puts ("Test data = #{test_data.to_json}")
  File.open("#{DATA_JSON_PATH}", 'w') do |file|
    file.write(test_data.to_json)
  end
  puts "Benchmark data created successfully!"
end

benchmark_data = collect_latest_benchmark_data("#{ENV_VARS['SH_HOME_DIR']}/#{ENV_VARS['PERFORMANCE_RESULTS_FOLDER']}")

# Check if data.json is older than any of the benchmark JSON files
DATA_JSON_PATH = "#{ENV_VARS['SH_HOME_DIR']}/#{ENV_VARS['PERFORMANCE_RESULTS_FOLDER']}/data.json"
if !File.exist?(DATA_JSON_PATH) || benchmark_data.any? { |b| File.mtime(DATA_JSON_PATH) < File.mtime("#{ENV_VARS['SH_HOME_DIR']}/#{ENV_VARS['PERFORMANCE_RESULTS_FOLDER']}/#{b[:file_name]}") }
  update_performance_data(benchmark_data)
end
