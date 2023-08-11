# frozen_string_literal: true

require 'rspec'
require './scripts/tools/change_checker'

RSpec.describe ChangeChecker do
  let(:path) { 'scripts' }
  let(:targets) { Paths::CHECKLISTS }
  let(:result) { ChangeChecker.changes?(path) }
  let(:checklist_file) { ChangeChecker.checklist_path(path) }

  describe '.changes?' do
    context 'given checklist file was not cleaned' do
      it 'should not exist' do
        ChangeChecker.clean_change_list
        result = File.file?(checklist_file)
        expect(result).to eq(false)
      end
    end

    context 'given checklist file was created' do
      it 'should exist' do
        ChangeChecker.clean_change_list
        ChangeChecker.create_changelist(path, targets)
        result = File.file?(checklist_file)
        expect(result).to eq(true)
      end
    end

    context 'given no changes made to underlying files since last run' do
      it 'should not report changes' do
        ChangeChecker.clean_change_list
        ChangeChecker.create_changelist(path, targets)
        expect(ChangeChecker.changes?(path)).to eq(false)
      end
    end

    context 'given changes made to underlying files since last run' do
      it 'should report changes' do
        ChangeChecker.clean_change_list
        ChangeChecker.create_changelist(path, targets)
        test_file = "#{path}/new.txt"
        File.write(test_file, 'hi')
        expect(ChangeChecker.changes?(path)).to eq(true)
        FileUtils.rm_f test_file
      end
    end

  end
end
