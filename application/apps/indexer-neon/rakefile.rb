# frozen_string_literal: true

require 'rake/clean'

LOCAL_EXAMPLE_DIR = "#{Dir.home}/tmp/logviewer_usecases"
TEST_DIR = './tests'
OUT_DIR = './out'

directory OUT_DIR
CLEAN.include(["#{OUT_DIR}/*.*",
               "#{LOCAL_EXAMPLE_DIR}/indexing/test.out",
               "#{LOCAL_EXAMPLE_DIR}/merging/merging_big/merged.out"])
# FileList["#{LOCAL_EXAMPLE_DIR}/dlt/*.out"].each { |f| rm f }

namespace :neon do
  task :rebuild do
    sh 'neon build --release'
  end

  desc 'test neon integration: dlt indexing'
  task dlt: [:clean, OUT_DIR, 'neon:rebuild'] do
    call_test_function('testDltIndexingAsync', './tests/testfile.dlt', './out/testfile.out')
  end

  desc 'test neon integration: discover timestamps'
  task discover: [:clean, OUT_DIR, 'neon:rebuild'] do
    call_test_function_with_array(
      'testDiscoverTimespanAsync',
      ['./tests/mini_with_invalids.log',
       "#{LOCAL_EXAMPLE_DIR}/indexing/access_huge.log",
       "#{LOCAL_EXAMPLE_DIR}/concat/2019-07-15_06.26.01.log"]
    )
  end

  desc 'test neon integration: dlt stats'
  task dlt_stats: [:clean, OUT_DIR, 'neon:rebuild'] do
    call_test_function('testCallDltStats', './tests/testfile.dlt')
  end

  desc 'test neon integration: concat'
  task concat: [:clean, OUT_DIR, 'neon:rebuild'] do
    call_test_function(
      'testCallConcatFiles',
      "#{LOCAL_EXAMPLE_DIR}/concat/concat.json.conf",
      "#{LOCAL_EXAMPLE_DIR}/concat/concatenated.out"
    )
  end

  desc 'test neon integration: merge'
  task merge: [:clean, OUT_DIR, 'neon:rebuild'] do
    call_test_function(
      'testCallMergeFiles',
      "#{LOCAL_EXAMPLE_DIR}/merging/merging_big/config.json",
      "#{LOCAL_EXAMPLE_DIR}/merging/merging_big/merged.out"
    )
  end

  desc 'test neon integration: regular indexing'
  task index: [:clean, OUT_DIR, 'neon:rebuild'] do
    call_test_function(
      'testIndexingAsync',
      "#{LOCAL_EXAMPLE_DIR}/indexing/access_huge.log",
      "#{LOCAL_EXAMPLE_DIR}/indexing/test.out"
    )
  end
  desc 'test neon integration: short indexing'
  task index_short: [:clean, OUT_DIR, 'neon:rebuild'] do
    call_test_function(
      'testIndexingAsync',
      "#{LOCAL_EXAMPLE_DIR}/indexing/access_tiny.log",
      "#{LOCAL_EXAMPLE_DIR}/indexing/test.out"
    )
  end
end

desc 'test neon integration for a problematic file'
task problem: [:clean, OUT_DIR, 'neon:rebuild'] do
  call_test_function('testDltIndexingAsync',
                     "#{LOCAL_EXAMPLE_DIR}/dlt/morton_problem_file.dlt",
                     "#{LOCAL_EXAMPLE_DIR}/dlt/morton_problem_file.dlt.out")
end
desc 'test neon integration stats for a huge file'
task stats: [:clean, OUT_DIR, 'neon:rebuild'] do
  call_test_function('testCallDltStats',
                     "#{LOCAL_EXAMPLE_DIR}/dlt/huge.dlt")
end
desc 'test neon timed out task'
task timedout: [:clean, OUT_DIR, 'neon:rebuild'] do
  call_test_function('testTimedOutAsyncIndexing',
                     "#{LOCAL_EXAMPLE_DIR}/indexing/access_huge.log",
                     "#{LOCAL_EXAMPLE_DIR}/indexing/test.out")
end
desc 'test neon cancel task'
task cancelled: [:clean, OUT_DIR, 'neon:rebuild'] do
  call_test_function('testCancelledAsyncIndexing',
                     "#{LOCAL_EXAMPLE_DIR}/indexing/access_huge.log",
                     "#{LOCAL_EXAMPLE_DIR}/indexing/test.out")
end

def call_test_function(function_name, *args)
  func_args = args.map { |a| "\"#{a}\"" }.join(',')
  node_exp = "require(\"./dist/tests.js\").#{function_name}(#{func_args})"
  sh "node -e '#{node_exp}'"
end

def call_test_function_with_array(function_name, list, *args)
  func_args = args.map { |a| "\"#{a}\"" }.join(',')
  node_exp = if func_args.empty?
               "require(\"./dist/tests.js\").#{function_name}(#{list})"
             else
               "require(\"./dist/tests.js\").#{function_name}(#{func_args}, #{list})"
             end
  sh "node -e '#{node_exp}'"
end

desc 'watch and rebuid ts files'
task :ts_watch do
  sh 'tsc -p ./tsconfig.json -w'
end
