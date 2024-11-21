# frozen_string_literal: true

require './scripts/tools/os'

# info of all paths used in chipmunk (OS dependend)
module Paths
  def self.release_build_folder
    if OS.windows?
      'win-unpacked'
    elsif OS.linux? && OS.arm64?
      'linux-arm64-unpacked'
    elsif OS.linux?
      'linux-unpacked'
    elsif OS.arm64?
      'mac-arm64'
    else
      'mac'
    end
  end

  def self.release_bin_folder
    if OS.windows?
      'win-unpacked'
    elsif OS.linux? && OS.arm64?
      'linux-arm64-unpacked'
    elsif OS.linux?
      'linux-unpacked'
    elsif OS.arm64?
      'mac-arm64/chipmunk.app/Contents/MacOS'
    else
      'mac/chipmunk.app/Contents/MacOS'
    end
  end

  def self.release_resources_folder
    if OS.windows?
      'win-unpacked/Resources'
    elsif OS.linux? && OS.arm64?
      'linux-arm64-unpacked/Resources'
    elsif OS.linux?
      'linux-unpacked/Resources'
    elsif OS.arm64?
      'mac-arm64/chipmunk.app/Contents/Resources'
    else
      'mac/chipmunk.app/Contents/Resources'
    end
  end

  ROOT = File.expand_path('../..', __dir__)
  APPS = "#{ROOT}/application/apps"

  WASM = "#{APPS}/rustcore/wasm-bindings"

  CHECKLISTS = "#{ROOT}/scripts/tools/file_checklists"
  CLIENT = "#{ROOT}/application/client"
  CLIENT_DIST = "#{CLIENT}/dist"

  ELECTRON = "#{ROOT}/application/holder"
  ELECTRON_DIST = "#{ELECTRON}/dist"
  ELECTRON_CLIENT_DEST = "#{ELECTRON_DIST}/client"
  TSC = "#{ELECTRON}/node_modules/.bin/tsc"

  INDEXER = "#{APPS}/indexer"
  JASMINE = './node_modules/.bin/electron ./node_modules/jasmine/bin/jasmine.js'
  PLATFORM = "#{ROOT}/application/platform"
  PLATFORM_DIST = "#{PLATFORM}/dist"
  RELEASE = "#{ELECTRON}/release"
  RELEASE_BIN = "#{RELEASE}/#{Paths.release_bin_folder}"
  RELEASE_BUILD = "#{RELEASE}/#{Paths.release_build_folder}"
  RELEASE_RESOURCES = "#{RELEASE}/#{Paths.release_resources_folder}"
  RUSTCORE = "#{ROOT}/application/apps/rustcore"
  RS_BINDINGS = "#{RUSTCORE}/rs-bindings"
  TS_BINDINGS = "#{RUSTCORE}/ts-bindings"
  UPDATER = "#{APPS}/precompiled/updater"

  PROTOCOL_WASM = "#{APPS}/protocol/wasm"
  PROTOCOL_GEN = "#{APPS}/protocol/proto"
end
