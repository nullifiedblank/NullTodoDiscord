require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const mongoose = require('mongoose');
const cron = require('node-cron');
const Task = require('./Task');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ Connected to MongoDB Atlas!'))
    .catch((error) => console.error('❌ MongoDB connection error:', error));

client.once('ready', () => {
    console.log(`🤖 Logged in as ${client.user.tag}!`);
    startReminderEngine();
});

// --- HELPER FUNCTION FOR PAGINATION ---
async function generateTaskList(userId, page) {
    const tasksPerPage = 10;
    const allTasks = await Task.find({ userId: userId }).sort({ dueDate: 1 });
    const totalPages = Math.ceil(allTasks.length / tasksPerPage) || 1;
    const startIndex = (page - 1) * tasksPerPage;
    const currentTasks = allTasks.slice(startIndex, startIndex + tasksPerPage);

    const embed = new EmbedBuilder().setTitle('📋 Your To-Do List').setColor('#0099ff').setFooter({ text: `Page ${page} of ${totalPages} • Total Tasks: ${allTasks.length}` });

    if (currentTasks.length === 0) {
        embed.setDescription("You have no pending tasks! You are all caught up.");
    } else {
        currentTasks.forEach((task, index) => {
            const dateStr = task.dueDate.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
            const descStr = task.description ? `\n*${task.description}*` : '';
            embed.addFields({ name: `${startIndex + index + 1}. ${task.taskName}`, value: `📅 Due: **${dateStr}**${descStr}` });
        });
    }

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`prev_${page}`).setLabel('◀ Previous').setStyle(ButtonStyle.Primary).setDisabled(page === 1),
        new ButtonBuilder().setCustomId(`next_${page}`).setLabel('Next ▶').setStyle(ButtonStyle.Primary).setDisabled(page === totalPages || totalPages === 0)
    );
    return { embeds: [embed], components: [row] };
}

// --- INTERACTION LISTENER ---
client.on('interactionCreate', async (interaction) => {
    
    // 1. Handle Autocomplete (Live Search)
    if (interaction.isAutocomplete()) {
        const focusedValue = interaction.options.getFocused();
        
        // Search MongoDB for tasks that match what the user is typing
        const choices = await Task.find({ 
            userId: interaction.user.id, 
            taskName: { $regex: focusedValue, $options: 'i' } // Case-insensitive search
        }).limit(25); // Discord allows a max of 25 autocomplete options

        // Send back the task names, but secretly use the Database ID as the underlying value
        await interaction.respond(
            choices.map(choice => ({ name: choice.taskName.substring(0, 100), value: choice._id.toString() }))
        );
        return;
    }

    // 2. Handle Slash Commands
    if (interaction.isChatInputCommand()) {
        
        if (interaction.commandName === 'addtask') {
            await interaction.deferReply({ ephemeral: true }); 
            const taskName = interaction.options.getString('task');
            const dateStr = interaction.options.getString('date');
            const timeStr = interaction.options.getString('time') || '23:59';
            const description = interaction.options.getString('description') || '';
            const dueDate = new Date(`${dateStr}T${timeStr}:00`);

            if (isNaN(dueDate.getTime())) return interaction.editReply('❌ Invalid date/time format!');

            const newTask = new Task({ userId: interaction.user.id, taskName, description, dueDate });
            await newTask.save();
            await interaction.editReply(`✅ Task saved! I am tracking **"${taskName}"**.`);
        }

        if (interaction.commandName === 'tasks') {
            await interaction.deferReply({ ephemeral: true });
            const responseData = await generateTaskList(interaction.user.id, 1);
            await interaction.editReply(responseData);
        }

        // --- NEW: DELETE TASK ---
        if (interaction.commandName === 'deletetask') {
            await interaction.deferReply({ ephemeral: true });
            // The string we get back is actually the secret database _id we set in the autocomplete!
            const taskId = interaction.options.getString('target_task'); 
            
            try {
                const deletedTask = await Task.findByIdAndDelete(taskId);
                if (!deletedTask) return interaction.editReply("❌ Task not found (it may have already been deleted).");
                await interaction.editReply(`🗑️ Successfully deleted: **"${deletedTask.taskName}"**`);
            } catch (err) {
                await interaction.editReply("❌ An error occurred while trying to delete the task.");
            }
        }

        // --- NEW: EDIT TASK ---
        if (interaction.commandName === 'edittask') {
            await interaction.deferReply({ ephemeral: true });
            const taskId = interaction.options.getString('target_task');
            
            try {
                const task = await Task.findById(taskId);
                if (!task) return interaction.editReply("❌ Task not found.");

                // Grab optional changes
                const newName = interaction.options.getString('new_name');
                const newDesc = interaction.options.getString('new_description');
                const newDateStr = interaction.options.getString('new_date');
                const newTimeStr = interaction.options.getString('new_time');

                if (newName) task.taskName = newName;
                if (newDesc) task.description = newDesc;
                
                // If they provided a new date or time, we need to rebuild the Date object
                if (newDateStr || newTimeStr) {
                    const finalDate = newDateStr || task.dueDate.toISOString().split('T')[0];
                    // Using toLocaleTimeString to safely grab the HH:MM if they only provided a new date
                    const finalTime = newTimeStr || task.dueDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); 
                    const newDueDate = new Date(`${finalDate}T${finalTime}:00`);
                    if (!isNaN(newDueDate.getTime())) task.dueDate = newDueDate;
                }

                await task.save();
                await interaction.editReply(`✏️ Successfully updated **"${task.taskName}"**! Use \`/tasks\` to see the changes.`);
            } catch (err) {
                console.error(err);
                await interaction.editReply("❌ An error occurred while trying to edit the task.");
            }
        }
    }

    // 3. Handle Button Clicks (Pagination)
    if (interaction.isButton()) {
        const [action, currentPageStr] = interaction.customId.split('_');
        let newPage = parseInt(currentPageStr);
        if (action === 'next') newPage++;
        if (action === 'prev') newPage--;

        const responseData = await generateTaskList(interaction.user.id, newPage);
        await interaction.update(responseData);
    }
});

// --- THE REMINDER ENGINE ---
function startReminderEngine() {
    cron.schedule('* * * * *', async () => {
        const now = new Date();
        try {
            const tasks = await Task.find({ dueDate: { $gt: now } });
            for (let task of tasks) {
                const timeDiffMs = task.dueDate.getTime() - now.getTime();
                const minutesLeft = Math.floor(timeDiffMs / (1000 * 60));
                let user;
                try { user = await client.users.fetch(task.userId); } catch (e) { continue; }

                if (minutesLeft <= 1440 && minutesLeft > 60 && !task.notified.includes('1day')) {
                    await user.send(`📅 **Reminder:** Your task "${task.taskName}" is due in 1 day!`);
                    task.notified.push('1day'); await task.save();
                } else if (minutesLeft <= 60 && minutesLeft > 1 && !task.notified.includes('1hour')) {
                    await user.send(`⏳ **Reminder:** Your task "${task.taskName}" is due in 1 hour!`);
                    task.notified.push('1hour'); await task.save();
                } else if (minutesLeft <= 1 && minutesLeft >= 0 && !task.notified.includes('1min')) {
                    await user.send(`🚨 **URGENT:** Your task "${task.taskName}" is due in 1 minute!`);
                    task.notified.push('1min'); await task.save();
                }
            }
        } catch (error) { console.error('Error checking tasks:', error); }
    });

    cron.schedule('0 9 * * *', async () => {
        const now = new Date();
        try {
            const overdueTasks = await Task.find({ dueDate: { $lt: now } });
            for (let task of overdueTasks) {
                try {
                    const user = await client.users.fetch(task.userId);
                    await user.send(`⚠️ **OVERDUE:** You still haven't completed "${task.taskName}"!`);
                } catch (e) { continue; }
            }
        } catch (err) { console.error('Daily nag error:', err); }
    });
}

client.login(process.env.DISCORD_TOKEN);