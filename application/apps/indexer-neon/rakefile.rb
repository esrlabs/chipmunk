# frozen_string_literal: true

require 'rake/clean'
require '../../../rake_extensions'

LOCAL_EXAMPLE_DIR = "#{Dir.home}/tmp/logviewer_usecases"
TEST_DIR = './tests'
OUT_DIR = './out'
NEON = './node_modules/.bin/neon'
NEON_BUILD_ENV = 'node_modules/.bin/electron-build-env'
TSC = './node_modules/.bin/tsc'
TESTS_JS_REQUIRE = 'require("./dist/apps/indexer-neon/src/tests.js")'
TEST_RUNNER = './node_modules/.bin/electron ./node_modules/jasmine-ts/lib/index.js'
HUGE_LOGFILE = "#{LOCAL_EXAMPLE_DIR}/indexing/access_huge.log"
MONSTER_LOGFILE = "#{LOCAL_EXAMPLE_DIR}/indexing/test_huge.log"

directory OUT_DIR
CLEAN.include(["#{OUT_DIR}/*.*",
               "#{LOCAL_EXAMPLE_DIR}/indexing/test.out",
               "#{LOCAL_EXAMPLE_DIR}/merging/merging_big/merged.out"])
# FileList["#{LOCAL_EXAMPLE_DIR}/dlt/*.out"].each { |f| rm f }

desc 'test'
task :test do
  sh "#{TSC} -p ./tsconfig.json"
  sh "#{NEON_BUILD_ENV} neon build --release"
  sh TEST_RUNNER
end

namespace :neon do
  desc 'rebuild neon'
  task :rebuild => :ts_build do
    sh "#{TSC} -p ./tsconfig.json"
    sh "#{NEON} build --release"
  end

  desc 'test all but super huge'
  task :all

  desc 'test neon integration: grab lines'
  task grabber: [:clean, OUT_DIR, 'neon:rebuild'] do
    call_test_function('testGrabLinesInFile',  HUGE_LOGFILE)
  end
  task all: 'neon:grabber'

  desc 'test neon integration: dlt non-verbose indexing'
  task dlt_nonverbose: [:clean, OUT_DIR, 'neon:rebuild'] do
    call_test_function('testDltIndexingAsync', "#{LOCAL_EXAMPLE_DIR}/dlt/nonverbose/longerlog.dlt",
                       "#{LOCAL_EXAMPLE_DIR}/dlt/nonverbose/longerlog.out",
                       50_000,
                       "#{LOCAL_EXAMPLE_DIR}/dlt/nonverbose/longerlog.xml")
  end
  task all: 'neon:dlt_nonverbose'

  desc 'test neon integration: dlt pcap indexing'
  task dlt_pcap: [:clean, OUT_DIR, 'neon:rebuild'] do
    call_test_function('testIndexingPcap', "#{LOCAL_EXAMPLE_DIR}/dlt/pcap/test.pcapng",
                       "#{LOCAL_EXAMPLE_DIR}/dlt/pcap/test.pcapng.out")
  end
  task all: 'neon:dlt_nonverbose'

  desc 'test neon integration: broken simple.xml'
  task dlt_nonverbose_broken: [:clean, OUT_DIR, 'neon:rebuild'] do
    call_test_function('testDltIndexingAsync',
                       "#{LOCAL_EXAMPLE_DIR}/dlt/nonverbose/longerlog3.dlt",
                       "#{LOCAL_EXAMPLE_DIR}/dlt/nonverbose/longerlog3.out",
                       50_000,
                       "#{LOCAL_EXAMPLE_DIR}/dlt/nonverbose/simple.xml")
  end
  task all: 'neon:dlt_nonverbose_broken'

  desc 'test neon integration: small dlt non-verbose indexing'
  task dlt_small_nonverbose: [:clean, OUT_DIR, 'neon:rebuild'] do
    call_test_function('testDltIndexingAsync', "#{LOCAL_EXAMPLE_DIR}/dlt/nonverbose/simple.dlt",
                       "#{LOCAL_EXAMPLE_DIR}/dlt/nonverbose/simple.out",
                       800,
                       "#{LOCAL_EXAMPLE_DIR}/dlt/nonverbose/simple.xml")
  end
  task all: 'neon:dlt_small_nonverbose'

  desc 'cancel dlt processing'
  task dlt_cancelled_nonverbose: [:clean, OUT_DIR, 'neon:rebuild'] do
    call_test_function('testCancelledAsyncDltIndexing',
                       "#{LOCAL_EXAMPLE_DIR}/dlt/nonverbose/simple.dlt",
                       "#{LOCAL_EXAMPLE_DIR}/dlt/nonverbose/longerlog.out",
                       50_000,
                       "#{LOCAL_EXAMPLE_DIR}/dlt/nonverbose/longerlog.xml")
  end
  task all: 'neon:dlt_cancelled_nonverbose'

  desc 'test neon integration: dlt indexing'
  task dlt: [:clean, OUT_DIR, 'neon:rebuild'] do
    call_test_function('testDltIndexingAsync', './tests/testfile.dlt', './out/testfile.out', 5000)
  end
  task all: 'neon:dlt'

  desc 'test neon integration: convert pcap to dlt'
  task convert_pcap2dlt: [:clean, OUT_DIR, 'neon:rebuild'] do
    call_test_function('testConvertPcapToDlt', "#{LOCAL_EXAMPLE_DIR}/dlt/pcap/test.pcapng")
  end
  task all: 'neon:convert_pcap2dlt'

  desc 'test neon integration: discover timestamps'
  task discover: [:clean, OUT_DIR, 'neon:rebuild'] do
    call_test_function_with_array(
      'testDiscoverTimestampAsync',
      ['./tests/mini_with_invalids.log',
       HUGE_LOGFILE,
       "#{LOCAL_EXAMPLE_DIR}/concat/2019-07-15_06.26.01.log"]
    )
  end
  task all: 'neon:discover'

  desc 'test neon integration: dlt stats'
  task dlt_stats: [:clean, OUT_DIR, 'neon:rebuild'] do
    call_test_function('testCallDltStats', "#{LOCAL_EXAMPLE_DIR}/dlt/morten_3.dlt")
  end
  task all: 'neon:dlt_stats'

  desc 'test neon integration: dlt over socket'
  task dlt_socket: [:clean, OUT_DIR, 'neon:rebuild'] do
    call_test_function('testSocketDlt', "#{LOCAL_EXAMPLE_DIR}/dlt/socket_upd.out")
  end
  task all: 'neon:dlt_socket'

  desc 'test neon integration: concat kurt'
  task concat_kurt: [:clean, OUT_DIR, 'neon:rebuild'] do
    call_test_function(
      'testCallConcatFiles',
      "#{LOCAL_EXAMPLE_DIR}/concat/concat_kurt.json.conf",
      "#{LOCAL_EXAMPLE_DIR}/concat/concatenated_kurt.out",
      30
    )
  end
  task all: 'neon:concat_kurt'

  desc 'test neon integration: concat'
  task concat: [:clean, OUT_DIR, 'neon:rebuild'] do
    call_test_function(
      'testCallConcatFiles',
      "#{LOCAL_EXAMPLE_DIR}/concat/concat.json.conf",
      "#{LOCAL_EXAMPLE_DIR}/concat/concatenated.out",
      100
    )
  end
  task all: 'neon:concat'

  desc 'test neon integration: merge'
  task merge: [:clean, OUT_DIR, 'neon:rebuild'] do
    call_test_function(
      'testCallMergeFiles',
      "#{LOCAL_EXAMPLE_DIR}/merging/merging_big/config.json",
      "#{LOCAL_EXAMPLE_DIR}/merging/merging_big/merged.out"
    )
  end
  task all: 'neon:merge'

  desc 'test neon integration: regular indexing'
  task index: [:clean, OUT_DIR, 'neon:rebuild'] do
    call_test_function(
      'testIndexingAsync',
      HUGE_LOGFILE,
      "#{LOCAL_EXAMPLE_DIR}/indexing/test.out",
      500
    )
  end
  task all: 'neon:index'

  desc 'test neon integration: short indexing'
  task index_short: [:clean, OUT_DIR, 'neon:rebuild'] do
    call_test_function(
      'testIndexingAsync',
      "#{LOCAL_EXAMPLE_DIR}/indexing/access_tiny.log",
      "#{LOCAL_EXAMPLE_DIR}/indexing/test.out",
      7
    )
  end
  task all: 'neon:index_short'

  desc 'test neon integration for a problematic file'
  task problem: [:clean, OUT_DIR, 'neon:rebuild'] do
    call_test_function('testDltIndexingAsync',
                       "#{LOCAL_EXAMPLE_DIR}/dlt/morton_problem_file.dlt",
                       "#{LOCAL_EXAMPLE_DIR}/dlt/morton_problem_file.dlt.out",
                       5000)
  end
  task all: 'neon:problem'

  desc 'test neon integration for a problematic file2'
  task problem2: [:clean, OUT_DIR, 'neon:rebuild'] do
    call_test_function('testDltIndexingAsync',
                       "#{LOCAL_EXAMPLE_DIR}/dlt/morten_3.dlt",
                       "#{LOCAL_EXAMPLE_DIR}/dlt/morten_3.dlt.out",
                       5000)
  end
  task all: 'neon:problem'

  desc 'test neon integration stats for a huge file'
  task stats: [:clean, OUT_DIR, 'neon:rebuild'] do
    call_test_function('testCallDltStats',
                       "#{LOCAL_EXAMPLE_DIR}/dlt/huge.dlt")
  end
  task all: 'neon:stats'

  desc 'test neon cancel task'
  task cancelled: [:clean, OUT_DIR, 'neon:rebuild'] do
    call_test_function('testCancelledAsyncIndexing',
                       HUGE_LOGFILE,
                       "#{LOCAL_EXAMPLE_DIR}/indexing/test.out")
  end
  task all: 'neon:cancelled'

  desc 'test check format string'
  task format: [:clean, OUT_DIR, 'neon:rebuild'] do
    call_test_function('testCheckFormatString', 'YYYY-MM-DDThh:mm:ss')
    call_test_function('testCheckFormatString', 'MM-DDThh:mm:ss')
  end
  task all: 'neon:format'
end

def exec_node_expression(node_exp)
  puts "executing rust function: #{node_exp}"
  system({ 'ELECTRON_RUN_AS_NODE' => 'true' }, "./node_modules/.bin/electron -e '#{node_exp}'")
end

def escape_strings(arg)
  if arg.class == Integer
    arg.to_s
  else
    "\"#{arg}\""
  end
end

def call_test_function(function_name, *args)
  func_args = args.map { |a| escape_strings(a) }.join(',')
  node_exp = "#{TESTS_JS_REQUIRE}.#{function_name}(#{func_args})"
  exec_node_expression(node_exp)
end

def call_test_function_with_array(function_name, list, *args)
  func_args = args.map { |a| "\"#{a}\"" }.join(',')
  node_exp = if func_args.empty?
               "#{TESTS_JS_REQUIRE}.#{function_name}(#{list})"
             else
               "#{TESTS_JS_REQUIRE}.#{function_name}(#{func_args}, #{list})"
             end
  exec_node_expression(node_exp)
end

desc 'watch and rebuid ts files'
task :ts_watch do
  sh 'tsc -p ./tsconfig.json -w'
end
desc 'rebuid ts files'
task :ts_build do
  sh 'tsc -p ./tsconfig.json'
end

desc 'Format code with nightly cargo fmt'
task :format do
  cd 'native' do
    sh 'cargo +nightly fmt'
  end
end

desc 'Check'
task :check do
  cd 'native' do
    sh 'cargo +nightly fmt -- --color=always --check'
    sh 'cargo clippy'
  end
end
