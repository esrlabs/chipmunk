# frozen_string_literal: true

require 'rake'
require 'set'
require './scripts/tools/shell'
require './scripts/env/paths'

# functionality to detect changes on monitored files
module ChangeChecker
  # Creates a file with the last modified time of the latest changed file in the list of underlying folders,
  # except the omitted folder locations.
  # This creates an offline map of changes made to a path, and helps
  # to check if any changes in files have been done in the path since
  # the previous run.
  def self.create_changelist(user, path, omissions = [])
    FileUtils.mkdir_p Paths::CHECKLISTS
    checklist_path = ChangeChecker.checklist_path(user, path)
    File.write(checklist_path, ChangeChecker.fingerprint(path, omissions))
  end

  # Method checks whether a 'path' has changes to files in underlying folders, excluding the folders in the 'omissions' list.
  # Returns true if its the first time we are building the checklist of file changes or if any file has changed since last run.
  def self.changes?(user, path)
    old_checklist_file = ChangeChecker.checklist_path(user, path)
    @first_run = !File.file?(old_checklist_file)
    return true if @first_run

    old_fingerprint = eval(File.read(old_checklist_file))
    new_fingerprint = ChangeChecker.fingerprint(path, old_fingerprint[:omissions])
    old_fingerprint[:entries] != new_fingerprint[:entries]
  end

  def self.reset(user, path, omissions = nil)
    old_checklist_file = ChangeChecker.checklist_path(user, path)
    if !omissions.nil? && ChangeChecker.changefile_exists?(user, path)
      old_fingerprint = eval(File.read(old_checklist_file))
      # reuse omissions
      old_omissions = old_fingerprint[:omissions]
      ChangeChecker.create_changelist(user, path, old_omissions)
    else
      omissions ||= []
      ChangeChecker.create_changelist(user, path, omissions)
    end
  end

  def self.changefile_exists?(user, path)
    checklist_file = ChangeChecker.checklist_path(user, path)
    File.file?(checklist_file)
  end

  def self.fingerprint(path, omissions = [])
    current_entries = {}
    ChangeChecker.folders_to_check(path, omissions).each do |loc|
      current_entries[loc] = ChangeChecker.timestamp_of_newest_file(loc, path).to_s
    end
    { entries: current_entries, omissions: omissions }
  end

  def self.timestamp_of_newest_file(loc, path)
    files_to_check = Dir.glob(loc + (loc == path ? '/*.*' : '/**/*.*')).select do |f|
      File.file?(f) && f != "#{Paths::TS_BINDINGS}/src/native/index.node"
    end
    files_to_check.map { |f| File.mtime(f) }.max
  end

  def self.checklist_path(user, path)
    "#{Paths::CHECKLISTS}/.#{ChangeChecker.element_name(path)}_#{user}_checklist.chk"
  end

  def self.element_name(path)
    path.split('/')[-1]
  end

  def self.folders_to_check(path, omissions = [])
    Dir.glob("#{path}/*").select { |f| File.directory?(f) && !omissions.include?(f) } << path
  end

  def self.clean_change_list
    files_to_clean = Dir.glob("#{Paths::CHECKLISTS}/.*")
    puts "removing change checker files: #{files_to_clean.map { |p| File.basename(p) }}"
    FileUtils.rm_f files_to_clean
  end
end

desc 'Clean change list'
task :clean_change_list do
  ChangeChecker.clean_change_list
end
