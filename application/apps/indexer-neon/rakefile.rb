require 'rake/clean'

LOCAL_EXAMPLE_DIR = "~/tmp/logviewer_usecases"
TEST_DIR = "./tests"
OUT_DIR = "./out"

directory OUT_DIR
CLEAN.include(["#{OUT_DIR}/*.*"])
# FileList["#{LOCAL_EXAMPLE_DIR}/dlt/*.out"].each { |f| rm f }

task :rebuild_neon do
  sh "neon build --release"
end

desc "test neon integration of indexing"
task :neon_test => [:clean, OUT_DIR, :rebuild_neon] do
  call_test_function("testDltIndexingAsync", "./tests/testfile.dlt", "./out/testfile.out")
end

desc "dlt stats"
task :dlt_stats do
  call_test_function("testCallDltStats", "./tests/testfile.dlt")
end

def call_test_function(function_name, *args)
  func_args = args.map { |a| "\"#{a}\"" }.join(",")
  node_exp = "require(\"./dist/tests.js\").#{function_name}(#{func_args})"
  sh "node -e '#{node_exp}'"
end

