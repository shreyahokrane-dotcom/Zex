"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { User, onAuthStateChanged, signOut } from "firebase/auth";
import { firebaseAuth } from "../../lib/firebase";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(firebaseAuth, (currentUser) => {
      setUser(currentUser);
      setIsCheckingAuth(false);

      if (!currentUser) {
        router.replace("/login");
      }
    });
  }, [router]);

  async function handleLogout() {
    await signOut(firebaseAuth);
    router.replace("/login");
  }

  if (isCheckingAuth) {
    return (
      <main className="dashboardShell">
        <section className="dashboardPanel">
          <p className="eyebrow">Zex</p>
          <h1>Loading dashboard...</h1>
        </section>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main className="dashboardShell">
      <section className="dashboardPanel">
        <div className="authBrand">
          <div className="brandMark" aria-hidden="true">
            Z
          </div>
          <span>Zex Dashboard</span>
        </div>

        <div>
          <p className="eyebrow">Signed in</p>
          <h1>Welcome back</h1>
          <p className="dashboardEmail">{user.email}</p>
        </div>

        <div className="dashboardGrid">
          <article>
            <span>Chats</span>
            <strong>Ready</strong>
          </article>
          <article>
            <span>Firebase</span>
            <strong>Connected</strong>
          </article>
          <article>
            <span>Workspace</span>
            <strong>Active</strong>
          </article>
        </div>

        <div className="dashboardActions">
          <Link href="/">Open chat</Link>
          <button type="button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </section>
    </main>
  );
}
