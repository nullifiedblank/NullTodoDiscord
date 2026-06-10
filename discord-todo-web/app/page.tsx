import { getServerSession } from "next-auth";
import Link from "next/link";

export default async function Home() {
  const session = await getServerSession();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-900 text-white p-6">
      <div className="text-center space-y-6 max-w-2xl">
        <h1 className="text-5xl font-extrabold tracking-tight">
          Your Life, <span className="text-indigo-400">Organized.</span>
        </h1>
        <p className="text-xl text-gray-400">
          The all-in-one Discord bot that tracks your tasks, sends you reminders, and gives you a beautiful web dashboard.
        </p>
        <div className="pt-8">
          {session ? (
            <Link href="/dashboard" className="bg-indigo-500 hover:bg-indigo-600 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all">
              Enter Dashboard
            </Link>
          ) : (
            <Link href="/api/auth/signin" className="bg-[#5865F2] hover:bg-[#4752C4] text-white px-8 py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3 w-64 mx-auto">
              Login with Discord
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}