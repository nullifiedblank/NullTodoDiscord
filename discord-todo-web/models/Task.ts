import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    userName: { type: String, required: true }, // NEW: Saves the Discord name
    taskName: { type: String, required: true },
    description: { type: String, default: "" },
    dueDate: { type: Date, required: true },
    isPublic: { type: Boolean, default: false }, // NEW: The privacy toggle
    notified: { type: [String], default: [] }
});

const Task = mongoose.models.Task || mongoose.model('Task', taskSchema);

export default Task;