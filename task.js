const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    taskName: { type: String, required: true },
    description: { type: String, default: "" },  // <-- We added the description here
    dueDate: { type: Date, required: true },
    notified: { type: [String], default: [] }
});

module.exports = mongoose.model('Task', taskSchema);