# frozen_string_literal: true

require './scripts/tools/shell'

module Status
  Done = 'done'
  Skipped = 'skipped'
  Failed = 'failed'
  Removed = 'removed'
  Other = 'other'
end

class Reporter
  def self.log(msg)
    puts "#{Time.now}: #{msg}"
  end

  @jobs = []

  %i[done skipped failed removed other].each do |status|
    singleton_class.define_method status do |owner, description, icon, duration = nil|
      Reporter.add(status, owner, description, icon, duration)
    end
  end

  def self.add(type, owner, description, icon, duration)
    owner_str = if owner.is_a? String
                  owner
                else
                  owner.class.to_s
                end
    @jobs.push({
                 'type' => type,
                 'owner' => owner_str,
                 'description' => description,
                 'icon' => icon,
                 'duration' => duration,
               })
    return if Shell.is_verbose_hidden

    duration_string = duration.nil? ? '' : " (duration: #{duration.round(1)}s)"
    puts "#{icon_type(type)}\t[#{align(type, 10)}]\t[#{align(owner_str, 10)}]: #{description}#{duration_string}"
  end

  def self.print
    @jobs.each do |job|
      duration_string = job['duration'].nil? ? '' : " (duration: #{job['duration'].round(1)}s)"
      puts "#{icon_type(job['type'])}\t[#{align(job['type'], 10)}]\t[#{align(job['owner'], 10)}]: #{job['description']}#{duration_string}"
    end
    Shell.report
  end

  def self.short_path(p)
    require 'pathname'
    Pathname.new(p).each_filename.to_a.last(4).join('/')
  end
end

def align(content, len)
  spaces = len - content.length
  spaces = 0 if spaces.negative?
  "#{content}#{' ' * spaces}"
end

def icon_type(type)
  case type
  when :done
    '*'
  when :skipped
    '-'
  when :failed
    'x'
  when :removed
    '>'
  when :other
    '?'
  else
    '...'
  end
end
