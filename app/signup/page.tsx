"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { firebaseAuth } from "../../lib/firebase";

export default function SignupPage() {
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
      await createUserWithEmailAndPassword(firebaseAuth, email, password);
      setStatus("Account created successfully.");
      router.push("/dashboard");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to create account.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="authShell">
      <section className="authPanel" aria-labelledby="signup-title">
        <div className="authBrand">
          <div className="brandMark" aria-hidden="true">
            Z
          </div>
          <span>Zex</span>
        </div>

        <div>
          <p className="eyebrow">Start secure</p>
          <h1 id="signup-title">Sign up</h1>
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
              placeholder="Minimum 6 characters"
              minLength={6}
              required
            />
          </label>

          <button type="submit" disabled={isLoading}>
            {isLoading ? "Creating..." : "Create account"}
          </button>
        </form>

        {status ? <p className="authStatus">{status}</p> : null}

        <p className="authSwitch">
          Already have an account? <Link href="/login">Login</Link>
        </p>
      </section>
    </main>
  );
}
