/** After a member deletes their account. Shown outside the app shell, with no way back in. */
export default function Goodbye() {
  return (
    <main className="min-h-screen bg-lob-cream flex items-center justify-center p-6">
      <div className="max-w-sm text-center space-y-3">
        <img
          src="/logo-256.webp"
          alt="Padel Lobsters"
          width="64"
          height="64"
          className="w-16 h-16 rounded-full bg-white p-1 object-contain mx-auto"
        />
        <h1 className="text-xl font-bold text-lob-dark">Your account is deleted</h1>
        <p className="text-sm text-lob-slate">
          Thanks for playing with the Lobsters. Your personal info is gone, and your past results
          stay under an anonymous name.
        </p>
        <p className="text-sm text-lob-slate">
          If you&apos;d like to play with us again, you&apos;re welcome to sign up as a new member.
        </p>
      </div>
    </main>
  )
}
