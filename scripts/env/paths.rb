module Paths
  def self.get_release_build_folder
    if OS.windows?
      'win-unpacked'
    elsif OS.linux?
      'linux-unpacked'
    else
      'mac'
    end
  end

  def self.get_release_bin_folder
    if OS.windows?
      'win-unpacked'
    elsif OS.linux?
      'linux-unpacked'
    else
      'mac/chipmunk.app/Contents/MacOS'
    end
  end

  def self.get_release_resources_folder
    if OS.windows?
      'win-unpacked/Resources'
    elsif OS.linux?
      'linux-unpacked/Resources'
    else
      'mac/chipmunk.app/Contents/Resources'
    end
  end
  TS_BINDINGS = 'application/apps/rustcore/ts-bindings'
  RS_BINDINGS = 'application/apps/rustcore/rs-bindings'
  CLIENT = 'application/client'
  CLIENT_DIST = 'application/client/dist'
  ELECTRON = 'application/holder'
  ELECTRON_DIST = 'application/holder/dist'
  ELECTRON_CLIENT_DEST = 'application/holder/dist/client'
  TSBINDINGS = 'application/apps/rustcore/ts-bindings'
  RUSTCORE = 'application/apps/rustcore'
  INDEXER = 'application/apps/indexer'
  PLATFORM = 'application/platform'
  PLATFORM_DIST = 'application/platform/dist'
  CLIPPY_NIGHTLY = 'cargo +nightly clippy --all --all-features -- -D warnings -A clippy::uninlined_format_args'
  TSC = "#{ELECTRON}/node_modules/.bin/tsc"
  CONFIG = 'scripts/config.json'
  MATCHER = 'application/apps/webassembly/matcher'
  ANSI = 'application/apps/webassembly/ansi'
  UTILS = 'application/apps/webassembly/utils'
  UPDATER = 'application/apps/precompiled/updater'
  RELEASE = 'application/holder/release'
  RELEASE_BIN = "#{RELEASE}/#{Paths.get_release_bin_folder}"
  RELEASE_RESOURCES = "#{RELEASE}/#{Paths.get_release_resources_folder}"
  RELEASE_BUILD = "#{RELEASE}/#{Paths.get_release_build_folder}"
  JASMINE = './node_modules/.bin/electron ./node_modules/jasmine/bin/jasmine.js'
  CHECKLISTS = 'scripts/tools/file_checklists'
end
