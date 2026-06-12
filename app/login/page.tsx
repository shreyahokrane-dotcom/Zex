"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { firebaseAuth } from "../../lib/firebase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setIsLoading(true);

    try {
      await signInWithEmailAndPassword(firebaseAuth, email, password);
      setStatus("Signed in successfully.");
      router.push("/dashboard");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to sign in.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="authShell">
      <section className="authPanel" aria-labelledby="login-title">
        <div className="authBrand">
          <div className="brandMark" aria-hidden="true">
            Z
          </div>
          <span>Zex</span>
        </div>

        <div>
          <p className="eyebrow">Welcome back</p>
          <h1 id="login-title">Login</h1>
        </div>

        <form className="authForm" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter password"
              required
            />
          </label>

          <button type="submit" disabled={isLoading}>
            {isLoading ? "Signing in..." : "Login"}
          </button>
        </form>

        {status ? <p className="authStatus">{status}</p> : null}

        <p className="authSwitch">
          New to Zex? <Link href="/signup">Create an account</Link>
        </p>
      </section>
    </main>
  );
}
