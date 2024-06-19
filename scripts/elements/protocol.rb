# frozen_string_literal: true

require './scripts/env/paths'
require './scripts/env/env'
require './scripts/tools/shell'
module Protocol
  FLATBUFFERS_REPO = "https://github.com/google/flatbuffers.git"
  FLATBUFFERS_DIR = "flatbuffers"
  FLATBUFFERS_PATH = "#{Paths::PROTOCOL}/#{FLATBUFFERS_DIR}"
  OUTPUT_RS = "#{Paths::PROTOCOL}/output/binding/rust/protocol/gen"
  OUTPUT_TS = "#{Paths::PROTOCOL}/output/binding/ts/protocol/gen"
  TARGETS = [OUTPUT_RS, OUTPUT_TS, FLATBUFFERS_PATH].freeze

end

namespace :protocol do
  desc 'install latest flatbuffers'
  task :install_flatbuffers do
    Shell.chdir(Paths::PROTOCOL) do
      Shell.sh "git clone #{Protocol::FLATBUFFERS_REPO}" unless File.exist?(Protocol::FLATBUFFERS_DIR)
      Reporter.done('protocol', "clonned: #{Protocol::FLATBUFFERS_PATH}", '')
    end
    Shell.chdir(Protocol::FLATBUFFERS_PATH) do
      Shell.sh "cmake -G \"Unix Makefiles\""
      Shell.sh "make -j"
      Reporter.done('protocol', "built: #{Protocol::FLATBUFFERS_PATH}", '')
    end
  end

  desc 'remove flatbuffers'
  task :remove_flatbuffers do
    if File.exist?(Protocol::FLATBUFFERS_PATH) 
      Shell.rm_rf(Protocol::FLATBUFFERS_PATH)
      Reporter.removed('protocol', "removed: #{Protocol::FLATBUFFERS_PATH}", '')  
    end
  end

  desc 'compile'
  task :compile do
    if File.exist?(Protocol::OUTPUT_RS) 
      Shell.rm_rf(Protocol::OUTPUT_RS)
      Reporter.removed('protocol', "removed: #{Protocol::OUTPUT_RS}", '')  
    end
    if File.exist?(Protocol::OUTPUT_TS) 
      Shell.rm_rf(Protocol::OUTPUT_TS)
      Reporter.removed('protocol', "removed: #{Protocol::OUTPUT_TS}", '')  
    end
    Shell.chdir(Paths::PROTOCOL) do
      Shell.sh "./flatbuffers/flatc --ts -o ./output/binding/ts/protocol/gen -I include $(find ./binding -name '*.fbs')"
      Shell.sh "./flatbuffers/flatc --rust -o ./output/binding/rust/protocol/gen -I include $(find ./binding -name '*.fbs')"
      Reporter.done('protocol', "generated in: #{Protocol::OUTPUT_RS}", '')
      Reporter.done('protocol', "generated in: #{Protocol::OUTPUT_TS}", '')
    end
  end

  desc 'Generate'
  task generate: [
    'protocol:install_flatbuffers',
    'protocol:compile',
  ]
end
