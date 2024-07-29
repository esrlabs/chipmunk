require 'octokit'
require 'tmpdir'
require 'fileutils'
require 'json'


ENV['REPO_OWNER'] ||= 'esrlabs'
ENV['REPO_NAME'] ||= 'chipmunk'

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

def usage
  puts "Usage: ruby scripts/tools/run_benchmarks.rb <number_of_releases>/<start_tag-end_tag>/PR~<PR_NUMBER>"
  exit(1)
end

def compute_average_of_benchmarks(result_path)
  data = JSON.parse(File.read(result_path))

  grouped_data = data.group_by { |test| test['name'] }

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

  File.write(result_path, JSON.pretty_generate(averages))
end

client = Octokit::Client.new

def fetch_pull_request(client, pr_number)
  client.pull_request("esrlabs/chipmunk", pr_number)
end

def fetch_releases(client)
  client.releases("#{ENV['REPO_OWNER']}/#{ENV['REPO_NAME']}")
end

def parse_arguments(arg)
  if arg.start_with?('PR~')
    pr_number = arg.split('~').last
    { type: :pr, value: pr_number }
  elsif arg.match?(/\A\d+(\.\d+)?\z/)
    number_of_releases = arg.to_i == 0 ? 1 : arg.to_i
    { type: :number_of_releases, value: number_of_releases }
  elsif arg.include?('-')
    start_tag, end_tag = arg.split('-')
    { type: :range, value: [start_tag, end_tag] }
  else
    usage
  end
end

def set_environment_vars
  {
    'JASMIN_TEST_CONFIGURATION' => './spec/benchmarks.json',
    'PERFORMANCE_RESULTS_FOLDER' => 'chipmunk_performance_results',
    'PERFORMANCE_RESULTS' => '',
    'SH_HOME_DIR' => "/chipmunk"
    # 'SH_HOME_DIR' => "/Users/sameer.g.srivastava"
  }
end

def clone_and_setup_repo(branch_or_tag_name, temp_dir)
  system("git clone --depth 1 --branch #{branch_or_tag_name} https://github.com/#{ENV['REPO_OWNER']}/#{ENV['REPO_NAME']}.git #{temp_dir}")
  FileUtils.cp_r("#{SHELL_SCRIPT_PATH}/.", "#{temp_dir}/#{SHELL_SCRIPT_PATH}/.", verbose: true)
  FileUtils.cp_r("scripts/elements/bindings.rb", "#{temp_dir}/scripts/elements/bindings.rb", verbose: true)
end

def process_release_or_pr(branch_or_tag_name, identifier, env_vars)
  Dir.mktmpdir do |temp_dir|
    begin
      clone_and_setup_repo(branch_or_tag_name, temp_dir)
      result_path = "#{env_vars['SH_HOME_DIR']}/#{env_vars['PERFORMANCE_RESULTS_FOLDER']}/Benchmark_#{identifier}.json"

      Dir.chdir(temp_dir) do
        env_vars.each { |key, value| ENV[key] = value }
        ENV['PERFORMANCE_RESULTS'] = "Benchmark_#{identifier}.json"
        system("corepack enable")
        system("yarn cache clean")

        next unless File.exist?("#{SHELL_SCRIPT_PATH}/#{env_vars['JASMIN_TEST_CONFIGURATION'].gsub('./spec/', '')}")

        puts "Benchmark.json file available."

        FileUtils.rm(result_path, verbose: true) if File.exist?(result_path)

        RAKE_COMMANDS.each do |command|
          puts "Running #{command} for #{identifier}"
          system(command)
        end
      end

      if File.exist?(result_path)
        compute_average_of_benchmarks(result_path)
        puts "Benchmark results:"
        system("cat #{result_path}")
      else
        puts "Benchmark results not found at #{result_path}."
      end
    rescue => e
      puts "An error occurred while processing #{identifier}: #{e.message}"
    end

    puts "Completed processing #{identifier}"
  end
end

def read_benchmark_data(file_path)
  data = JSON.parse(File.read(file_path))
  { file_name: File.basename(file_path), data: data }
end

def collect_latest_benchmark_data(directory)
  Dir.glob("#{directory}/Benchmark_*.json").reject { |file| File.basename(file).start_with?('Benchmark_PR') }.map do |file|
    read_benchmark_data(file)
  end
end

def update_performance_data(data, data_file_path)
  test_data = data.each_with_object({}) do |benchmark, hash|
    benchmark[:data].each do |entry|
      test_name = entry['name']
      actual_value = entry['actual']
      release = benchmark[:file_name].gsub("Benchmark_", "").gsub(".json", "")

      hash[test_name] ||= []
      hash[test_name] << { release: release, actual_value: actual_value }
    end
  end
  test_data = test_data.to_json
  puts "Data written to #{data_file_path}\n#{test_data}"
  File.write(data_file_path, test_data)
  puts "Benchmark data created successfully!"
end

arg = ARGV[0] || usage
parsed_arg = parse_arguments(arg)
env_vars = set_environment_vars

case parsed_arg[:type]
when :pr
  pr_number = parsed_arg[:value]
  pull_request = fetch_pull_request(client, pr_number)
  branch_name = pull_request.head.ref
  puts "Running benchmarks for the pull request: #{pull_request.title} (#{branch_name})"
  process_release_or_pr(branch_name, "PR_#{pr_number}", env_vars)
when :number_of_releases
  releases = fetch_releases(client).take(parsed_arg[:value]) rescue 1
  puts "Running benchmarks for the last #{parsed_arg[:value]} release/s"
  releases.each { |release| process_release_or_pr(release.tag_name, release.tag_name, env_vars) }
when :range
  start_tag, end_tag = parsed_arg[:value]
  releases = fetch_releases(client).select { |release| release.tag_name >= start_tag && release.tag_name <= end_tag }
  puts "Running benchmarks for releases #{start_tag} - #{end_tag}"
  releases.each { |release| process_release_or_pr(release.tag_name, release.tag_name, env_vars) }
end

benchmark_data = collect_latest_benchmark_data("#{env_vars['SH_HOME_DIR']}/#{env_vars['PERFORMANCE_RESULTS_FOLDER']}")

DATA_JSON_PATH = "#{env_vars['SH_HOME_DIR']}/#{env_vars['PERFORMANCE_RESULTS_FOLDER']}/data.json"
if !File.exist?(DATA_JSON_PATH) || benchmark_data.any? { |file| File.mtime(DATA_JSON_PATH) < File.mtime("#{env_vars['SH_HOME_DIR']}/#{env_vars['PERFORMANCE_RESULTS_FOLDER']}/#{file[:file_name]}") && !file[:file_name].start_with?('Benchmark_PR') }
  update_performance_data(benchmark_data, DATA_JSON_PATH)
elsif parsed_arg[:type] == :pr
  pr_data_filepath = "#{env_vars['SH_HOME_DIR']}/#{env_vars['PERFORMANCE_RESULTS_FOLDER']}/Benchmark_PR_#{pr_number}.json"
  update_performance_data([read_benchmark_data(pr_data_filepath)], pr_data_filepath)
end
