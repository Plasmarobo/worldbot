const fs = require('fs');
const uuidv4 = require('uuid/v4');
const GoogleSpreadsheet = require('google-spreadsheet');

let ballot = function(bot_user, user, post_id, name, choices, roles, seconds)
{
    this.uuid = uuidv4();
    this.created_at = new Date().getTime() / 1000;
    this.expires_at = seconds + this.created_at;
    this.owner = user;
    this.bot_user = bot_user;
    this.name = name;
    this.max_rank = Object.keys(choices).length;
    this.votes = {}; // USER : [reaction]
    this.reaction_set = choices;
    this.lisener = null;
    this.message_id = post_id; // Message or NULL
    this.msg = null;
    this.allowed_roles = roles;
};

ballot.prototype.load = function(filename)
{

};

ballot.prototype.save = function(filename)
{

};

ballot.prototype.set_vote = function(user, reaction)
{
    this.votes[user.id] = reaction;
    this.save();
};

ballot.prototype.print_result = function(msg)
{
    //Create a new message in the channel with a summary
    let counts = {};
    let total = 0;
    let results = "Vote results for " + this.name + ":\n";
    for(let user in this.votes)
    {
        console.log(`User ${user} voted ${this.votes[user]}`);
        let vote = this.votes[user];
        if (!counts.hasOwnProperty(vote))
        {
            counts[vote] = 0;
        }
        counts[vote] += 1;
        total += 1;
    }

    console.log(counts);

    let majority_perc = 0;
    let majority_name = "No SuperMajoriy";
    for(let option in counts)
    {
        let name = this.reaction_set[option];
        let percent = ((100 * counts[option]) /  total);
        if (percent > majority_perc)
        {
            majority_name = name;
            majority_perc = percent;
        }
        results += `Option ${name} got ${counts[option]} votes: ${percent}%\n`;
    }
    let conclusion = "Inconclusive";
    if (majority_perc > 65)
    {
        conclusion = majority_name;
        results += `Clear majority: ${majority_name} (${majority_perc}%)`;
    }
    results += `Votes cast: ${total}`;

    msg.channel.send(results);
    
    var rowdata = {
        date: new Date().toISOString(),
        category: "Vote Result",
        title: ballot.title,
        result: conclusion,
        summary: results
    };
    var doc = new GoogleSpreadsheet("1BqgzPfgrq2BISVQFDZ_9oq02mDJiZocbTJCkOmzBy8Q");
    var creds = require('./google_credentials.json');
    doc.useServiceAccountAuth(creds,() => {
        doc.getInfo((err, info) => {
            if (err)
            {
                console.log(err);
                return;
            }
            console.log("Loaded Doc");
            for(var sheet of info.worksheets)
            {
                console.log(`Sheet ${sheet.title}, ${sheet.colCount} x ${sheet.rowCount}`);
                if (sheet.title == "EventLog")
                {

                    doc.addRow(sheet.id, rowdata, (err, row) => err ? console.log(err) : console.log("Wrote to gsheet"));
                }
            }
        });
    });

};

ballot.prototype.finish = function(msg)
{
    this.print_result(msg);
    if(this.listener != null)
    {
        this.expires_at = new Date().getTime();
        this.listener.stop("Finished");
        this.listener = null;
    }
}

let votelord = function() {
    this.ballots = {};
    this.roles = {};
    this.collectors = [];
};

votelord.prototype.save = function(filename)
{

}

votelord.prototype.load = function(filename)
{

};

votelord.prototype.parse_reactions = function(msg, reaction_set)
{
    if (!this.ballots.hasOwnProperty(msg.id))
    {
        console.log("Can't find", msg.id);
        return;
    }

    var ballot = this.ballots[msg.id];
    msg.channel.fetchMessage(msg.id)
    .then(ballot_msg => {
        ballot.msg = ballot_msg;
        ballot.listener = ballot_msg.createReactionCollector((reaction, user) => {
            ballot_msg.guild.fetchMember(user.id).then((guildUser) => {
                if (guildUser == null)
                {
                    reaction.remove();
                    console.log("User invalid");
                    return;
                }

                if (user.id != ballot.bot_user.id)
                {
                    if ((reaction.emoji.name in ballot.reaction_set) && (guildUser.roles.some(r => ballot.allowed_roles.includes(r.name)) || ballot.allowed_roles.length == 0))
                    {
                        ballot.set_vote(user, reaction.emoji.name);
                        console.log("Set vote");
                        guildUser.send(`You voted in ${ballot.name}: ${ballot.reaction_set[reaction.emoji.name]} (${reaction.emoji.name})`);
                        console.log(`User: ${user} Reacted: ${reaction.emoji.name}`);
                    }
                    reaction.remove(user.id);
                }
            })
            .catch(console.error);
            return true;
        }, { time: 1000 * (ballot.expires_at - (new Date().getTime() / 1000))});
        ballot.listener.on('collect', (reaction, collector) => {
            msg.channel.fetchMessage(ballot.message_id)
            .then((ballot_message) => {
                for(let user in collector.collection)
                {
                    if (user.id != ballot.bot_user.id)
                    {
                        reaction.remove(user.id);
                    }
                }
            })
            .catch(console.error);
        });
        ballot.listener.on('end', collected => {
            for(let reaction of ballot_msg.reactions)
            {
                for(let user in reaction.users)
                {
                    reaction.remove(user);
                }
            }
            ballot.finish(ballot_msg);
        });
    })
    .catch(console.error);
}

function getRoleName(option, roles)
{
    if(!option)
    {
        return;
    }

    if (option.startsWith("<@&") && option.endsWith(">"))
    {
        option = option.slice(3,-1);

        if (option.startsWith("!"))
        {
            option = option.slice(1);
        }

        return roles.get(option).name;
    }
    return option;
}

votelord.prototype.build_vote = function(msg, args)
{
    let name = args[1];
    if (Object.values(this.ballots).some(b => b.name == name))
    {
        console.log("ballot exists");
        msg.channel.send("Error: The name " + name + " exists");
        return;
    }
    let roles = [];
    let option_set = {};
    let option_cmds = args.slice(2);
    let sec = 2 * 24 * 60 * 60; // 48 hours
    for(let option of option_cmds)
    {
        let option_parts = option.split('=');
        if (option_parts.length > 2)
        {
            console.log("Malformated argument", option);
        }
        switch(option_parts[0])
        {
            case "role":
                roles.push(getRoleName(option_parts[1], msg.guild.roles));
                break;
            case "days":
                sec = parseInt(option_parts[1]) * 24 * 60 * 60;
                break;
            case "minutes":
                sec = parseInt(option_parts[1]) * 60;
                break;
            case "hours":
                sec = parseInt(option_parts[1]) * 60 * 60;
                break;
            case "option":
            default:
                option_set[option_parts[1]] = option_parts[0];
                break;
        }
    }

    //Generate message
    let message = "**" + name + "**\n";
    for(let opt of Object.keys(option_set))
    {
        message += "\n" + option_set[opt] + " - " + opt;
    }
    //Send message
    msg.channel.send(message)
    .then(async (ballot_message) => {
        console.log(`Ballot: Creator: ${msg.author}, Target: ${ballot_message.id}, Name: ${name}`);
        console.log("Roles: " + JSON.stringify(roles));
        console.log("Options: " + JSON.stringify(option_set));
        console.log("Timeframe (sec): " + sec);
        this.ballots[ballot_message.id] = new ballot(ballot_message.author, msg.author, ballot_message.id, name, option_set, roles, sec);
        let promises = [];
        for (let opt of Object.keys(option_set))
        {
            let emoji = msg.client.emojis.find(emoji => emoji.name == opt);
            if (emoji != null)
            {
                console.log(`Adding ${emoji.name}`);
                try {
                    await ballot_message.react(emoji.id);
                } catch(e) {
                    console.log(`Build_vote emoji react: ${e}`);
                }
            } else {
                console.log(`Adding ${opt}`);
                try {
                    await ballot_message.react(opt);
                } catch(e) {
                    console.log(`Build_vote unicode react: ${e}`);
                }
            }
        }
        this.parse_reactions(ballot_message, option_set);
    })
    .catch(e => console.log(`Build_vote: ${e}`));
};

votelord.prototype.end_vote = function(msg, args)
{
    console.log("Attempting to end " + args[1]);
    for(let id in this.ballots)
    {
        console.log("ID: " + id);
        let ballot = this.ballots[id];
        console.log(ballot.name);
        if (ballot.name == args[1])
        {
            ballot.finish(msg);
        }
        delete this.ballots[id];
    }
};

votelord.prototype.update_vote = function()
{

};

votelord.prototype.regenerate_collectors = function()
{
    for(var ballot in this.ballots)
    {
        if (ballot.message_id != null)
        {
            this.parse_reactions(ballot.channel, ballot.message_id, ballt.reaction_set);
        }
    }
};

votelord.prototype.handle = function(msg, args)
{
    switch(args[0]) 
    {
        // Create <name> <option=emoji>
        case "create":
            if (args.length < 4)
            {
                return this.help("create");
            }
            this.build_vote(msg, args);
            break;
        // Update <id> <option=emoji>
        case "update":
            break;

        case "end":
            if (args.length < 1)
            {
                return this.help("end");
            }
            this.end_vote(msg, args);
            break;

        case "vote":
            break;

        case "help":
        default:
            return this.help(args);
            break;
    }
}

votelord.prototype.help = function(args)
{
    let help_str = "Votelord Subsystem Help: ";
    switch(args[1])
    {
        case "create":
            help_str += "Create a vote with the following command: `create <name> <roles=role,role2,role3> <option=emoji>...` multiple option:emoji pairs may be used. Example: create MyPoll orange=:orange: apple=:apple:";
            break;
        case "update":
            help_str += "Not available at this time";
            break;
        case "end":
            help_str += "End a vote early: `end <name>`.";
            break;
        case "vote":
            help_str += "Privately vote. Not available at this time.";
            break;
        default:
            help_str += ""
            break;
    }
    return help_str;
}

exports.votelord = votelord;
