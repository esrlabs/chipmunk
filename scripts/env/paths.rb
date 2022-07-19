module Paths
  def self.get_release_build_folder
    if OS.windows?
      'win-unpacked'
    elsif OS.linux?
      'linux-unpacked'
    else
      'mac/chipmunk.app/Contents/MacOS'
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
  CLIPPY_NIGHTLY = 'cargo +nightly clippy --all --all-features -- -D warnings'
  CLIPPY_STABLE = 'cargo clippy --all --all-features -- -D warnings'
  TSC = "#{ELECTRON}/node_modules/.bin/tsc"
  CONFIG = 'scripts/config.json'
  MATCHER = 'application/apps/webassembly/matcher'
  LAUNCHERS = 'application/apps/launchers'
  RELEASE = 'application/holder/release'
  RELEASE_BUILD = "#{RELEASE}/#{Paths.get_release_build_folder}"
end
