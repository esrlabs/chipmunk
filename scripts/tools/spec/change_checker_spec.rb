# frozen_string_literal: true

require 'rspec'
require './scripts/tools/change_checker'

RSpec.describe ChangeChecker do
  let(:path) { 'scripts' }
  let(:targets) { Paths::CHECKLISTS }
  let(:result) { ChangeChecker.changes?('rspec', path) }

  describe '.changes?' do
    context 'given checklist file was not cleaned' do
      it 'should not exist' do
        ChangeChecker.clean_change_list
        expect(ChangeChecker.changefile_exists?('rspec', path)).to eq(false)
      end
    end

    context 'given checklist file was created' do
      it 'should exist' do
        ChangeChecker.clean_change_list
        ChangeChecker.create_changelist('rspec', path, targets)
        expect(ChangeChecker.changefile_exists?('rspec', path)).to eq(true)
      end
    end

    context 'given no changes made to underlying files since last run' do
      it 'should not report changes' do
        ChangeChecker.clean_change_list
        ChangeChecker.create_changelist('rspec', path, targets)
        expect(ChangeChecker.changes?('rspec', path)).to eq(false)
      end
    end

    context 'given changes made to underlying files since last run' do
      it 'should report changes' do
        ChangeChecker.clean_change_list
        ChangeChecker.create_changelist('rspec', path, targets)
        test_file = "#{path}/new.txt"
        File.write(test_file, 'hi')
        expect(ChangeChecker.changes?('rspec', path)).to eq(true)
        FileUtils.rm_f test_file
      end
    end
  end
end
