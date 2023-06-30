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

  ANSI = 'application/apps/webassembly/ansi'
  CHECKLISTS = 'scripts/tools/file_checklists'
  CLIENT = 'application/client'
  CLIENT_DIST = 'application/client/dist'
  CONFIG = 'scripts/config.json'
  ELECTRON = 'application/holder'
  ELECTRON_CLIENT_DEST = 'application/holder/dist/client'
  ELECTRON_DIST = 'application/holder/dist'
  INDEXER = 'application/apps/indexer'
  JASMINE = './node_modules/.bin/electron ./node_modules/jasmine/bin/jasmine.js'
  MATCHER = 'application/apps/webassembly/matcher'
  PLATFORM = 'application/platform'
  PLATFORM_DIST = 'application/platform/dist'
  RELEASE = 'application/holder/release'
  RELEASE_BIN = "#{RELEASE}/#{Paths.get_release_bin_folder}"
  RELEASE_BUILD = "#{RELEASE}/#{Paths.get_release_build_folder}"
  RELEASE_RESOURCES = "#{RELEASE}/#{Paths.get_release_resources_folder}"
  RS_BINDINGS = 'application/apps/rustcore/rs-bindings'
  RUSTCORE = 'application/apps/rustcore'
  TSC = "#{ELECTRON}/node_modules/.bin/tsc"
  TS_BINDINGS = 'application/apps/rustcore/ts-bindings'
  UPDATER = 'application/apps/precompiled/updater'
  UTILS = 'application/apps/webassembly/utils'
end
