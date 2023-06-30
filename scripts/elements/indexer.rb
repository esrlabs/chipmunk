# frozen_string_literal: true

require './scripts/env/paths'
class Indexer
  def initialize
    @target_indexer_base = "#{Paths::INDEXER}/indexer_base/target"
    @target_indexer_cli = "#{Paths::INDEXER}/indexer_cli/target"
    @target_merging = "#{Paths::INDEXER}/merging/target"
    @target_parsers = "#{Paths::INDEXER}/parsers/target"
    @target_processor = "#{Paths::INDEXER}/processor/target"
    @target_session = "#{Paths::INDEXER}/session/target"
    @target_sources = "#{Paths::INDEXER}/sources/target"
    @target = OS.executable("#{Paths::UPDATER}/target/release/updater")
    @targets = [@target_indexer_base, @target_indexer_cli, @target_merging, @target_parsers,
                @target_processor, @target_session, @target_sources]
  end

  attr_reader :targets

  def changes_to_files
    puts "This is #{@targets}"
    ChangeChecker.has_changes?(Paths::INDEXER, @targets)
  end
end
