const settings = require('./settings.json');

const Discord = require('discord.js');
const fs = require('fs');
const client = new Discord.Client();

const timebot = require('./timebot_calendar.js');
let calendar = new timebot.calendar();

let chunk_arguments = function(input)
{
	// Chunks arguments by space, unless between quotes
	return input.match(/(?:[^\s"]+|"[^"]*")+/g);
};

client.on('ready', () => {
	console.log(`Server started as ${client.user.tag}`);
	try {
		calendar.load();
	} catch(e) {
		console.log(e);
		calendar.set(0,0);
	}
});

client.on('message', msg => {
	if (msg.content.startsWith(settings.prefix))
	{
		let args = chunk_arguments(msg.content);
		if (typeof(args) == "undefined" || args == null || args.length < 2)
		{
			console.log("Malformed command");
			broadcast([msg.channel.id], "Malformed command");
			return;
		}
		console.log(`Command <${args}> from ${msg.author.id}`);
		handle_command(msg, args[1], args.splice(2));
	}
});

let whitelist = [];
try {
	whitelist = require('./whitelist.json');
} catch(e) {
	console.log(e);
}

let has_permission_to_run = function(msg, restrictions)
{
	if (typeof(restrictions) == "undefined")
	{
		return true;
	}
	if(msg.member.roles.some(r=>restrictions.includes(r.name)) ) {
		// has one of the roles
		return true;
	} else {
		return settings.admin_users.includes(msg.author.id); 
	}
	return false;
}

let parse_id = function(raw)
{
	
	let matches = raw.match(/<[@|#]!?(\d+)>/);
	if (matches != null && matches.length > 1)
	{
		return matches[1];
	}
	return raw;
}

let broadcast = function(channels, text)
{
	console.log("Broadcast", text);
	if (text == null)
	{
		return;
	}
	for(let channel_id of channels)
	{
		let id = parse_id(channel_id);
		console.log("ID: ", id);
		let chan = client.channels.get(id);
		chan.send(text);
	}
};

let reply = function(user, text)
{
	user.send(text);
}

let handle_command = function(msg, command, args)
{
	let handler = command_handlers[command];
	if (typeof(handler) != "undefined")
	{
		if (has_permission_to_run(msg, handler.restrict_to))
		{
			handler.handler(msg, args);
		} else {
			broadcast([msg.channel.id], `${msg.author.username} does not have permission to run that`);
		}
	} else {
		broadcast([msg.channel.id], `${msg.author.username}, I'm not sure what you wanted to do, try \`!help\``);
	}
};

const command_handlers = {
	"weather": {
		handler: function(msg, args) {
			broadcast([msg.channel.id], "It is currently " + calendar.getweather() + "ing");
			msg.delete(500);
		},
		help: "`weather`\nPrints the current weather in the area"
	},
	"setweather": {
		handler: function(msg, args) {
			broadcast(whitelist, calendar.setweather(args[0]));
			msg.delete(500);
		},
		help: "`setweather <name>`\nSets the current weather in the area",
		restrict_to: settings.admin_roles
	},
	"addweather": {
		handler: function(msg, args) {
			broadcast([msg.channel.id], calendar.addweather(args[0], args[1], args[2], args[3]));
			msg.delete(500);
		},
		help: "`addweather <name> <short-desc> <change-text> <seasons>`\nAdds a type of weather\nname: short name for the weather, used to select it\nshort-desc: brief description of weather\nchange-text:text to broadcast on select\nseasons: comma-seperated list of seasons",
		restrict_to: settings.admin_roles
	},
	"delweather": {
		handler: function(msg, args) {
			broadcast([msg.channel.id], calendar.delweather(args[0]));
			msg.delete(500);
		},
		help: "`delweather <name>\nDelete a weather",
		restrict_to: settings.admin_roles
	},
	"listweather": {
		handler: function(msg, args) {
			broadcast([msg.channel.id], calendar.listweather());
			msg.delete(500);
		},
		help: "`listweather`\nLists possible weather",
		restrict_to: settings.admin_roles
	},
	"date": {
		handler: function(msg, args) {
			broadcast([msg.channel.id], calendar.description());
			msg.delete(500);
		},
		help: "`date`\nPrints the current date in the world"
	},
	"time": {
		handler: function(msg, args) {
			broadcast([msg.channel.id], "It is " + calendar.time_str());
			msg.delete(500);
		},
		help: "`time`\nPrints the current time in the world"
	},
	"offsettime": {
		handler: function(msg, args) {
			broadcast([msg.channel.id], calendar.set_offset(parseInt(args[0])));
			msg.delete(500);
		},
		help: "`offsettime <seconds>`\nSets offset to UTC in seconds",
		restrict_to: settings.admin_roles
	},
	"setdate": {
		handler: function(msg, args) {
			// Formats
			// month day year
			// day year
			let day = 0;
			let year = 0;
			if (args.length >  2)
			{
				day = 30 * parseInt(args[0]) + parseInt(args[1]);
				year = parseInt(args[2]);
			} else {
				day = parseInt(args[0]);
				year = parseInt(args[1]);
			}
			calendar.set(day, year);
			calendar.save();
			broadcast(whitelist, calendar.description());
			msg.delete(500);
		},
		help: "`setdate <date format>`\nSets the current day and year in either `month day year` or `day/365 year` format\nDay: # of days to set (since 0)\nYear: # year to set (since 0)",
		restrict_to: settings.admin_roles
	},
	"tick": {
		handler: function(msg, args) {
			let days = 1;
			if (args.length > 0)
			{
				days = parseInt(args[0]);
			}
			calendar.advance(days);
			calendar.save();
			broadcast(whitelist, calendar.description());
			msg.delete(500);
		},
		help: "`tick <# days>`\nAdvances time\nDays: # of days to tick (1 if omitted)",
		restrict_to: settings.admin_roles
	},
	"season" : {
		handler: function(msg, args) {
			broadcast([msg.channel.id], "It is " + calendar.getseason() + ".");
			msg.delete(500);
		},
		help: "`season`\nGet's current season"
	},
	"randweather": {
		handler: function(msg, args) {
			broadcast(whitelist, calendar.randweather());
			msg.delete(500);
		},
		help: "`randweather`\nRandomize the weather, based on season",
		restrict_to: settings.admin_roles
	},
	"whitelist": {
		handler: function(msg, args) {
			for(let channel of args)
			{
				channel = parse_id(channel);
				console.log(`White list ${channel}`);
				if (!whitelist.includes(channel))
				{
					whitelist.push(channel);
				}
			}
			console.log(whitelist);
			fs.writeFileSync("./whitelist.json", JSON.stringify(whitelist, null, 2));
			msg.delete(500);
		},
		help: "`whitelist <channel>`\nEnables the bot on a channel\nchannel: channel id (`#channelname`)",
		restrict_to: settings.admin_roles
	},
	"blacklist": {
		handler: function(msg, args) {
			for(let channel of args)
			{
				channel = parse_id(channel);
				console.log(`Black list ${channel}`);
				let idx = whitelist.findIndex(what => what == channel);
				if (idx != -1)
				{
					whitelist.splice(idx, 1);
				}
			}
			fs.writeFileSync("./whitelist.json", JSON.stringify(whitelist, null, 2));
			msg.delete(500);
		},
		help: "`blacklist <channel>`\nDisables the bot on a channel\nchannel: channel id (`#channelname`)",
		restrict_to: settings.admin_roles
	},
	"add_admin_role": {
		handler: function(msg, args)
		{
			settings.admin_roles.push(args[0]);
			fs.writeFileSync("./settings.json", JSON.stringify(settings, null, 2));
			msg.delete(500);
		},
		help: "`add_admin_role <\@rolename>`",
		restrict_to: settings.admin_roles
	},
	"del_admin_role": {
		handler: function(msg, args)
		{
			settings.splice(settings.admin_roles.findIndex(args[0]), 1);
			fs.writeFileSync("./settings.json", JSON.stringify(settings, null, 2));
			msg.delete(500);
		},
		help: "`del_admin_role <\@rolename>`",
		restrict_to: settings.admin_roles
	},
	"help": {
		handler: function(msg, args) {
			if (args.length > 0)
			{
				let helptext = command_handlers[args[0]].help;
				reply(msg.author, helptext);
			} else {
				let text = "Possible commands, try `help <command>`\n```";
				for(let handler in command_handlers) {
					text += handler + "\n";
				}
				reply(msg.author, text + "```");
			}
		},
		help: "`help <command>`\nPrints the help text for `command`"
	},
	"restart": {
		handler: function(msg, args) {
			process.exit();
		},
		help: "`restart`\nExits the bot process (systemd will restart)"
	}
};

client.login(process.env["TIMEBOT_TOKEN"]);
