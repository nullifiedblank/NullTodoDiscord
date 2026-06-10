"use server";

import { connectToDB } from "@/lib/mongodb";
import Task from "@/models/Task";
import User from "@/models/User";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "./api/auth/[...nextauth]/route";

// Action to Delete a task
export async function deleteTask(formData: FormData) {
  const taskId = formData.get("taskId");
  await connectToDB();
  await Task.findByIdAndDelete(taskId);
  
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/team");
  revalidatePath("/dashboard/breakdown");
}

// Action to Add a task
export async function addTask(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) return;

  const isPublic = formData.get("isPublic") === "on";

  await connectToDB();
  await Task.create({
    userId: (session.user as any).id,
    userName: session.user.name,
    taskName: formData.get("taskName"),
    dueDate: formData.get("dueDate"),
    description: formData.get("description") || "",
    isPublic: isPublic,
  });
  
  revalidatePath("/dashboard"); 
  revalidatePath("/dashboard/team");
  revalidatePath("/dashboard/breakdown");
}

// Action to Edit a task
export async function editTask(formData: FormData) {
  const taskId = formData.get("taskId");
  const taskName = formData.get("taskName");
  const description = formData.get("description");
  const dueDate = formData.get("dueDate");
  const isPublic = formData.get("isPublic") === "on";
  const assignedUserId = formData.get("assignedUserId");

  await connectToDB();
  
  // Look up their name in the roster so the UI updates properly
  const assignedUser = await User.findOne({ userId: assignedUserId });
  const newUserName = assignedUser ? assignedUser.name : "Unknown User";

  const task = await Task.findByIdAndUpdate(taskId, { 
    taskName, 
    description, 
    dueDate,
    isPublic,
    userId: assignedUserId,
    userName: newUserName
  });

  // Send the Discord Notification
  if (task && process.env.DISCORD_BOT_TOKEN) {
    try {
      const dmRes = await fetch('https://discord.com/api/v10/users/@me/channels', {
        method: 'POST',
        headers: {
          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ recipient_id: assignedUserId }), // Notifies the NEWly assigned user
      });
      const dmData = await dmRes.json();

      if (dmData.id) {
        await fetch(`https://discord.com/api/v10/channels/${dmData.id}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: `✏️ **Task Updated:** "${taskName}" has been modified on the dashboard!`
          }),
        });
      }
    } catch (error) {
      console.error("Discord notification failed:", error);
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/team");
  revalidatePath("/dashboard/breakdown");
}