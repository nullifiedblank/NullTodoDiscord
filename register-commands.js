require('dotenv').config();
const { REST, Routes, ApplicationCommandOptionType } = require('discord.js');

const commands = [
    {
        name: 'addtask',
        description: 'Add a new task with a specific date and description!',
        options: [
            { name: 'task', description: 'What do you need to do?', type: ApplicationCommandOptionType.String, required: true },
            { name: 'date', description: 'Due date (Format: YYYY-MM-DD)', type: ApplicationCommandOptionType.String, required: true },
            { name: 'time', description: 'Time in 24hr format (e.g., 14:30). Defaults to 12:00', type: ApplicationCommandOptionType.String, required: false },
            { name: 'description', description: 'Extra details', type: ApplicationCommandOptionType.String, required: false }
        ]
    },
    {
        name: 'tasks',
        description: 'List all your current tasks by urgency!',
    },
    {
        name: 'deletetask',
        description: 'Remove a task from your list.',
        options: [
            { 
                name: 'target_task', 
                description: 'Start typing to search your tasks...', 
                type: ApplicationCommandOptionType.String, 
                required: true, 
                autocomplete: true // <-- This enables the live search!
            }
        ]
    },
    {
        name: 'edittask',
        description: 'Edit an existing task.',
        options: [
            { name: 'target_task', description: 'Start typing to search your tasks...', type: ApplicationCommandOptionType.String, required: true, autocomplete: true },
            { name: 'new_name', description: 'Change the task name', type: ApplicationCommandOptionType.String, required: false },
            { name: 'new_date', description: 'Change the date (YYYY-MM-DD)', type: ApplicationCommandOptionType.String, required: false },
            { name: 'new_time', description: 'Change the time (HH:MM)', type: ApplicationCommandOptionType.String, required: false },
            { name: 'new_description', description: 'Change the description', type: ApplicationCommandOptionType.String, required: false }
        ]
    }
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('⏳ Registering commands with Autocomplete...');
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
        console.log('✅ Updated slash commands registered successfully!');
    } catch (error) {
        console.error(`❌ Error: ${error}`);
    }
})();