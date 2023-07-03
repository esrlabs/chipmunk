# frozen_string_literal: true

require './scripts/env/paths'
class Indexer
  TARGET_INDEXER_BASE = "#{Paths::INDEXER}/indexer_base/target"
  TARGET_INDEXER_CLI = "#{Paths::INDEXER}/indexer_cli/target"
  TARGET_MERGING = "#{Paths::INDEXER}/merging/target"
  TARGET_PARSERS = "#{Paths::INDEXER}/parsers/target"
  TARGET_PROCESSOR = "#{Paths::INDEXER}/processor/target"
  TARGET_SESSION = "#{Paths::INDEXER}/session/target"
  TARGET_SOURCES = "#{Paths::INDEXER}/sources/target"
  TARGETS = [
    TARGET_INDEXER_BASE,
    TARGET_INDEXER_CLI,
    TARGET_MERGING,
    TARGET_PARSERS,
    TARGET_PROCESSOR,
    TARGET_SESSION,
    TARGET_SOURCES].freeze

  def self.changes_to_files
    ChangeChecker.has_changes?(Paths::INDEXER, TARGETS)
  end

  def self.clean
    Shell.chdir Paths::INDEXER do
      Shell.sh 'cargo clean'
    end
  end
end
