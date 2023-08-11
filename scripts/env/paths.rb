# frozen_string_literal: true

require './scripts/tools/os'

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

  ROOT = File.expand_path('../..', __dir__)
  ANSI = "#{ROOT}/application/apps/webassembly/ansi"
  CHECKLISTS = "#{ROOT}/scripts/tools/file_checklists"
  CLIENT = "#{ROOT}/application/client"
  CLIENT_DIST = "#{ROOT}/application/client/dist"
  CONFIG = "#{ROOT}/scripts/config.json"
  ELECTRON = "#{ROOT}/application/holder"
  ELECTRON_CLIENT_DEST = "#{ROOT}/application/holder/dist/client"
  ELECTRON_DIST = "#{ROOT}/application/holder/dist"
  INDEXER = "#{ROOT}/application/apps/indexer"
  JASMINE = './node_modules/.bin/electron ./node_modules/jasmine/bin/jasmine.js'
  MATCHER = "#{ROOT}/application/apps/webassembly/matcher"
  PLATFORM = "#{ROOT}/application/platform"
  PLATFORM_DIST = "#{ROOT}/application/platform/dist"
  RELEASE = "#{ROOT}/application/holder/release"
  RELEASE_BIN = "#{RELEASE}/#{Paths.get_release_bin_folder}"
  RELEASE_BUILD = "#{RELEASE}/#{Paths.get_release_build_folder}"
  RELEASE_RESOURCES = "#{RELEASE}/#{Paths.get_release_resources_folder}"
  RS_BINDINGS = "#{ROOT}/application/apps/rustcore/rs-bindings"
  RUSTCORE = "#{ROOT}/application/apps/rustcore"
  TSC = "#{ELECTRON}/node_modules/.bin/tsc"
  TS_BINDINGS = "#{ROOT}/application/apps/rustcore/ts-bindings"
  UPDATER = "#{ROOT}/application/apps/precompiled/updater"
  UTILS = "#{ROOT}/application/apps/webassembly/utils"
end
