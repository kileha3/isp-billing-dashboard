"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wifi, AlertCircle, ArrowLeft, MailCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { z } from "zod";

const emailSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  function isValid() {
    return emailSchema.safeParse({ email }).success;
  }

  function handleChange(value: string) {
    setEmail(value);
    setEmailError("");
    setServerError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = emailSchema.safeParse({ email });
    if (!result.success) {
      setEmailError(result.error.errors[0]?.message ?? "Invalid email");
      return;
    }
    setLoading(true);
    setServerError("");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api"}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? data?.message ?? "Request failed");
      setSent(true);
    } catch (err: unknown) {
      // On 404 or API error, still show success to prevent email enumeration
      setSent(true);
      void err;
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <Wifi className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-semibold tracking-tight text-foreground">NetBill</span>
        </div>

        <Card className="border-border shadow-sm">
          {sent ? (
            <>
              <CardHeader className="space-y-1 pb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-2">
                  <MailCheck className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">Check your email</CardTitle>
                <CardDescription>
                  If <strong>{email}</strong> is registered, you will receive a password reset link shortly.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/login">
                  <Button variant="outline" className="w-full">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Sign In
                  </Button>
                </Link>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader className="space-y-1 pb-4">
                <CardTitle className="text-xl">Reset password</CardTitle>
                <CardDescription>
                  Enter your account email and we will send you a password reset link.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  {serverError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{serverError}</AlertDescription>
                    </Alert>
                  )}
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="admin@example.com"
                      value={email}
                      onChange={(e) => handleChange(e.target.value)}
                      autoComplete="email"
                      autoFocus
                    />
                    {emailError && <p className="text-xs text-destructive">{emailError}</p>}
                  </div>
                  <Button type="submit" className="w-full" disabled={loading || !isValid()}>
                    {loading ? "Sending…" : "Send Reset Link"}
                  </Button>
                </form>
              </CardContent>
            </>
          )}
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-5">
          <Link href="/login" className="inline-flex items-center gap-1 text-primary hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Sign In
          </Link>
        </p>
        <p className="text-center text-xs text-muted-foreground mt-3">
          NetBill ISP Billing Platform &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
