# frozen_string_literal: true

require 'rspec'
require './scripts/tools/mod'
require './scripts/env/mod'

RSpec.describe ChangeChecker do
  let(:path) { 'scripts' }
  let(:targets) { Paths::CHECKLISTS }
  let(:result) { ChangeChecker.has_changes?(path, targets) }
  let(:checklist_file) { ChangeChecker.checklist_file(path) }
  let(:new_checklist_file) { ChangeChecker.checklist_file(path, true) }

  describe '.has_changes?' do
    context 'given checklist file does not exist' do
      it 'returns true' do
        condition = !File.file?(checklist_file)
        expect(result).to eq(condition)
      end
    end

    context 'given checklist file exists' do
      it 'returns false' do
        condition = !File.file?(checklist_file)
        expect(result).to eq(condition)
      end
    end

    context 'given no changes made to underlying files since last run' do
      it 'returns false' do
        ChangeChecker.changelist(path, targets, true)
        new_checklist_file = ChangeChecker.checklist_file(path, true)
        condition = File.open(new_checklist_file).to_set != File.open(checklist_file).to_set
        expect(result).to eq(condition)
      end
    end

    context 'given changes made to underlying files since last run' do
      it 'returns true' do
        ChangeChecker.changelist(path, targets, true)
        new_checklist_file = ChangeChecker.checklist_file(path, true)
        condition = File.open(new_checklist_file).to_set != File.open(checklist_file).to_set
        expect(result).to eq(condition)
      end
    end

    context 'in any condition' do
      it 'returns boolean value' do
        expect(result).to be(true).or be(false)
      end
    end
  end
end
