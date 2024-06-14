# frozen_string_literal: true

require './scripts/env/paths'
require './scripts/env/env'
require './scripts/tools/shell'
module Protocol
  FLATBUFFERS_REPO = "https://github.com/google/flatbuffers.git"
  FLATBUFFERS_DIR = "flatbuffers"
  FLATBUFFERS_PATH = "#{Paths::PROTOCOL}/#{FLATBUFFERS_DIR}"
  OUTPUT = "#{Paths::PROTOCOL}/output"
  TARGETS = [OUTPUT, FLATBUFFERS_PATH].freeze

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
    if File.exist?(Protocol::OUTPUT) 
      Shell.rm_rf(Protocol::OUTPUT)
      Reporter.removed('protocol', "removed: #{Protocol::OUTPUT}", '')  
    end
    Shell.chdir(Paths::PROTOCOL) do
      Shell.sh "./flatbuffers/flatc --ts -o ./output/binding/ts -I include ./binding.fbs $(find ./binding -name '*.fbs')"
      Shell.sh "./flatbuffers/flatc --rust -o ./output/binding/rust -I include ./binding.fbs $(find ./binding -name '*.fbs')"
      Reporter.done('protocol', "generated in: #{Protocol::OUTPUT}", '')
    end
  end

  desc 'Generate'
  task generate: [
    'protocol:install_flatbuffers',
    'protocol:compile',
  ]
end
