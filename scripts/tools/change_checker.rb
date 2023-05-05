module ChangeChecker
  def self.changelist(path, recheck=nil)
    FileUtils.mkdir_p Paths::CHECKLISTS
  	system ('find ' + path + ' ' + ChangeChecker.prune_paths(path) + ' -type f -exec md5sum {} \; > ' + ChangeChecker.checklist_file(path, recheck))
  end

  def self.has_changes?(path)
    @first_run = !File.file?(ChangeChecker.checklist_file(path))
  	ChangeChecker.changelist(path) if @first_run
  	ChangeChecker.changelist(path, true)
  	system ('diff -rq '+ ChangeChecker.checklist_file(path) + ' ' + ChangeChecker.checklist_file(path, true) + '> ' + ChangeChecker.difference_file(path))
  	count = %x{wc -l #{ChangeChecker.difference_file(path)}}.split.first.to_i
  	if count>0 || !File.file?(ChangeChecker.checklist_file(path))
  	  Shell.rm(ChangeChecker.checklist_file(path))
  	  FileUtils.mv(ChangeChecker.checklist_file(path, true), ChangeChecker.checklist_file(path))
  	else
  	  Shell.rm(ChangeChecker.checklist_file(path, true))
  	end
  	Shell.rm(ChangeChecker.difference_file(path))
  	count>0 || @first_run
  end

  def self.checklist_file(path, recheck=nil)
  	Paths::CHECKLISTS + '/' + ChangeChecker.element_name(path) + '_checklist' + (recheck.nil? ? '' : '_dup') + '.chk'
  end

  def self.element_name(path)
  	path.split('/')[-1]
  end

  def self.difference_file(path)
    Paths::CHECKLISTS + '/' + ChangeChecker.element_name(path) + '.txt'
  end

  def self.prune_paths(path)
    '-path ' + path + '/node_modules -prune -o -path ' + path + '/test_output -prune -o -path ' + path + '/target -prune -o -path ' + path + '/dist -prune -o'
  end
end