require 'dotenv/load'

module Notarization

  def self.check
    if OS.mac?
      if ENV.key?('SKIP_NOTARIZE')
        Reporter.add(Jobs::Skipped, Owner::Release, 'notarization is skipped', '')
        return
      end
      target = "#{Paths::RELEASE}/mac/chipmunk.app";
      Notarization.signature(target)
      Notarization.notarization(target)
      Reporter.add(Jobs::Other, Owner::Release, 'notarization is checked', '')
    else
      Reporter.add(Jobs::Skipped, Owner::Release, 'notarization is actual for darwin only', '')
    end
  end
  
  def self.signature(target)
    Rake.sh "codesign -vvv --deep --strict #{target}"
  end

  def self.notarization(target)
    Rake.sh "spctl -vvv --assess --type exec #{target}"
  end
end
