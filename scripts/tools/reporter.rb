module Status
  Done = 'done'
  Skipped = 'skipped'
  Failed = 'failed'
  Removed = 'removed'
  Other = 'other'
end

class Reporter
  @jobs = []

  [:done, :skipped, :failed, :removed, :other].each do |status|
    singleton_class.define_method status do |owner, description, icon|
      Reporter.add(status, owner, description, icon)
    end
  end

  def self.add(type, owner, description, icon)
    owner_str = if owner.is_a? String
                  owner
                else
                  "#{owner.class}"
                end
    @jobs.push({
                 'type' => type,
                 'owner' => owner_str,
                 'description' => description,
                 'icon' => icon
               })
    unless Shell.is_verbose_hidden
      puts "#{icon_type(type)}\t[#{align(type, 10)}]\t[#{align(owner_str, 10)}]: #{description}"
    end
  end

  def self.print
    @jobs.each do |job|
      puts "#{icon_type(job['type'])}\t[#{align(job['type'], 10)}]\t[#{align(job['owner'], 10)}]: #{job['description']}"
    end
  end
end

def align(content, len)
  spaces = len - content.length
  spaces = 0 if spaces < 0
  "#{content}#{' ' * spaces}"
end

def icon_type(type)
  case type
  when 'done'
    '*'
  when 'skipped'
    '*'
  when 'failed'
    '*'
  when 'removed'
    '*'
  when 'other'
    '*'
  else
    '...'
  end
end