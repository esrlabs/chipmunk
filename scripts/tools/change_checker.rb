# frozen_string_literal: true

require 'set'
require './scripts/tools/shell'

module ChangeChecker
  # Creates a file with the last modified time of the latest changed file in the list of underlying folders, except the omitted folder locations.
  # This creates an offline map of changes made to a path, and helps to check if any changes in files have been done in the path since the previous run.
  def self.changelist(path, omissions = [], recheck = nil)
    FileUtils.mkdir_p Paths::CHECKLISTS
    ChangeChecker.locations_to_check(path, omissions).each do |loc|
      File.open(ChangeChecker.checklist_file(path, recheck), 'a+') do |f|
        f.write("#{loc}=>" + File.mtime(Dir.glob(loc + (loc == path ? '/*' : '/**/*')).select { |f|
                                          f if File.file?(f) && f != "#{Paths::TS_BINDINGS}/src/native/index.node"
                                        }.max_by { |f|
                                          File.mtime(f)
                                        }).to_s + "\n")
      end
    end
  end

  # Method checks whether a 'path' has changes to files in underlying folders, excluding the folders in the 'ommisions' list.
  # Returns true if its the first time we are building the checklist of file changes or if any file has changed since last run.
  def self.has_changes?(path, omissions = [])
    old_checklist_file = ChangeChecker.checklist_file(path)
    new_checklist_file = ChangeChecker.checklist_file(path, true)
    @first_run = !File.file?(old_checklist_file)
    if @first_run
      ChangeChecker.changelist(path, omissions)
      return true
    end
    ChangeChecker.changelist(path, omissions, true)
    has_changed = File.open(new_checklist_file).to_set != File.open(old_checklist_file).to_set
    ChangeChecker.update_changelist(has_changed, new_checklist_file, old_checklist_file)
    has_changed
  end

  def self.checklist_file(path, recheck = nil)
    "#{Paths::CHECKLISTS}/.#{ChangeChecker.element_name(path)}_checklist#{recheck.nil? ? '' : '_dup'}.chk"
  end

  def self.element_name(path)
    path.split('/')[-1]
  end

  def self.locations_to_check(path, omissions = [])
    Dir.glob("#{path}/*").map { |f| f if File.directory?(f) && !omissions.include?(f) }.compact << path
  end

  def self.update_changelist(has_changed, new_checklist_file, old_checklist_file)
    FileUtils.mv(new_checklist_file, old_checklist_file) if has_changed
    Shell.rm(new_checklist_file)
  end
end