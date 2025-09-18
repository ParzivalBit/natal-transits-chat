'use client';

export default function SignOutButton() {
  async function signOut() {
    await fetch('/api/auth/signout', { method: 'POST' });
    window.location.href = '/';
  }
  return (
    <button className="rounded border px-3 py-1 text-sm" onClick={signOut}>
      Sign out
    </button>
  );
}
