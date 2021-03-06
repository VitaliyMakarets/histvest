# == Schema Information
#
# Table name: locations
#
#  id         :integer          not null, primary key
#  address    :string(255)
#  created_at :datetime         not null
#  updated_at :datetime         not null
#  latitude   :float
#  longitude  :float
#  gmaps      :boolean
#

# == Schema Information
#
# Table name: locations
#
#  id         :integer          not null, primary key
#  address    :string(255)
#  created_at :datetime         not null
#  updated_at :datetime         not null
#  topic_id   :integer
#  latitude   :float
#  longitude  :float
#  gmaps      :boolean
#
require 'truncate_html'

class Location < ActiveRecord::Base
	attr_accessible :address, :latitude, :longitude, :topic_id

	has_and_belongs_to_many :topics

	acts_as_gmappable :process_geocoding => false

	def gmaps4rails_address
		"#{self.address}"
	end


	
end
