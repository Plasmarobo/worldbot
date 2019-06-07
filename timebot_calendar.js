// Timebot Calendar, keeps time
const fs = require('fs');

let ordinal_suffix = function(i) {
	var j = i % 10,
		k = i % 100;
	if (j == 1 && k != 11) {
		return i + "st";
	}
	if (j == 2 && k != 12) {
		return i + "nd";
	}
	if (j == 3 && k != 13) {
		return i + "rd"l
	}
	return i + "th";
};

let timebot_month = function(index, name, common_name)
{
	this.index = index;
	this.name = name;
	this.common_name = common_name;
	return this;
};

timebot_month.prototype.full_description = function(day)
{
	return "It is the " + ordinal_suffix(day + 1) + " of " + this.common_name + ", the month of *" + this.name + "*";
};

timebot_month.prototype.description = function(day)
{
	return ordinal_suffix(day + 1) + " of " + this.name;
};

let timebot_calendar = function(day, year)
{
	this.months = 
	[
		new timebot_month(1, "Hanhder", "The First Genesis"),
		new timebot_month(2, "Tvhiper", "The Moon's Grace"),
		new timebot_month(3, "Korrin", "Fray's End"),
		new timebot_month(4, "Melorni", "Nature's Glory"),
		new timebot_month(5, "Pe'lothis", "The Light's Blessing"),
		new timebot_month(6, "Durerolp", "The Empress's Fortune"),
		new timebot_month(7, "Wolgemit", "Dawn of the Ruler"),
		new timebot_month(8, "Kolemis", "The First Father"),
		new timebot_month(9, "Corleno", "The Heart of Magic"),
		new timebot_month(10, "Laniller", "Saint of the Spirits"),
		new timebot_month(11, "Obishwer", "The Giver's Month"),
		new timebot_month(12, "Niversqer", "Dread of Winter")
	];
	this.seasons = {
		"spring": [3, 4, 5],
		"summer": [6, 7, 8],
		"fall": [9, 10, 11],
		"winter": [1, 2, 12]
	};

	this.year = year;
	this.day = day % 365;
	// Forgotten realm weeks are 10 days, each month has 30 days
	this.month_index = Math.floor(day / 30) % this.months.length;
	this.offset = 0;
	this.weather_list = {};
	this.current_weather = "";
};

timebot_calendar.prototype.load = function()
{
	let persist = require('./timebot_persist.json');
	this.year = persist.year;
	this.day = persist.day;
	this.month_index = Math.floor(this.day / 30) % this.months.length;
	this.offset = persist.offset;
	this.current_weather = persist.current_weather;
	this.weather_list = persist.weather_list;
};

timebot_calendar.prototype.save = function()
{
	let persist = {
		year: this.year,
		day: this.day,
		offset: this.offset,
		current_weather: this.current_weather,
		weather_list: this.weather_list
	};
	fs.writeFileSync("./timebot_persist.json", JSON.stringify(persist, null, 2));
};

timebot_calendar.prototype.getseason = function()
{
	let month = this.months[this.month_index];
	for(let name in this.seasons)
	{
		if (this.seasons[name].includes(month.index))
		{
			return name;
		}
	}
	return "season_error";
};

timebot_calendar.prototype.time = function()
{
	return new Date().getUTCSeconds() + this.offset;
};

timebot_calendar.prototype.set_offset = function(sec)
{
	this.offset = sec;
	this.save();
	return this.time_str();
};

timebot_calendar.prototype.time_str = function()
{
	let d = new Date();
	d.setUTCDate(this.time());
	return "Current time: " +
		String(d.getHours()).padStart(2, '0') +
		":" +
		String(d.getMinutes()).padStart(2, '0');
};

timebot_calendar.prototype.set = function(day, year)
{
	if (typeof(year) != "undefined")
	{
		this.year = year;
	}
	if (day < 1)
	{
		day = 1;
	}
	this.day = (day-1) % 365;
	this.month_index = Math.floor(this.day / 30) % this.months.length;
};

timebot_calendar.prototype.advance = function(days)
{
	let year_adv = Math.floor((this.day + days) / 365);

	this.set(this.day + days, this.year + year_adv);
};

timebot_calendar.prototype.description = function()
{
	console.log(this.month_index, this.months);
	let desc = this.months[this.month_index].full_description((this.day % 30));
	desc += ". It is the year " + this.year + ".";
	return desc;
};

timebot_calendar.prototype.addweather = function(name, desc, change, seasons)
{
	let seasons_list = seasons.split(',');
	this.weather_list[name] = {
		"desc": desc,
		"change": change,
		"seasons": seasons_list
	};
	this.save();
	return "Added " + name + ".";
};

timebot_calendar.prototype.delweather = function(name)
{
	delete this.weather_list[name];
	this.save();
	return "Deleted " + name + ".";
};

timebot_calendar.prototype.setweather = function(name)
{
	if (!Object.keys(this.weather_list).includes(name))
	{
		return "No weather with that name.";
	}
	if (this.current_weather != name)
	{
		this.current_weather = name;
		this.save();
		return this.weather_list[this.current_weather].change;
	}
	return "The " + this.weather_list[this.current_weather].desc + " continues.";
};

timebot_calendar.prototype.randweather = function()
{
	let season = this.getseason();
	let possible = Object.keys(this.weather_list).filter((weather) =>
	{
		return this.weather_list[weather].seasons.includes(season);
	});
	console.log(possible);
	return this.setweather(possible[Math.floor(Math.random() * possible.length)]);
};

timebot_calendar.prototype.getweather = function()
{
	return this.weather_list[this.current_weather].desc;
};

timebot_calendar.prototype.listweather = function()
{
	let msg = "```";
	for(let weather in this.weather_list)
	{
		msg += `${weather}: ${this.weather_list[weather].desc}\n`;
	}
	return msg + "```";
};

exports.month = timebot_month;
exports.calendar = timebot_calendar;
