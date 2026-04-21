"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Network, AlertCircle, MailCheck, ArrowLeft, Wifi } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { z } from "zod";
import { appName } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});

type ForgotPasswordForm = {
  email: string;
};

const FEATURES = [
  { icon: Network, title: "Instant Reset Link", desc: "Get a secure password reset link sent directly to your email inbox." },
  { icon: Wifi, title: "24/7 Network Access", desc: "Never lose access to your dashboard — reset anytime, anywhere." },
  { icon: MailCheck, title: "Fast Delivery", desc: "Reset links arrive within seconds, not minutes." },
  { icon: ArrowLeft, title: "Easy Recovery", desc: "Simple process to get you back to managing your network." },
];

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [form, setForm] = useState<ForgotPasswordForm>({ email: "" });
  const [emailError, setEmailError] = useState("");
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const { toast } = useToast();

  function isValid() {
    return forgotPasswordSchema.safeParse(form).success;
  }

  function setEmail(value: string) {
    setForm(f => ({ ...f, email: value }));
    setEmailError("");
    setServerError("");
  }

  function validate(): boolean {
    const result = forgotPasswordSchema.safeParse(form);
    if (!result.success) {
      setEmailError(result.error.errors[0]?.message ?? "Invalid email");
      return false;
    }
    setEmailError("");
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    
    setLoading(true);
    setServerError("");
    
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api"}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email }),
      });
      
      await res.json().catch(() => ({}));
      setSent(true);
    } catch (err: unknown) {
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen flex">
        {/* Left — success panel */}
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 bg-background">
          <div className="w-full max-w-sm">
            <div className="flex items-center justify-center gap-2 mb-8">
              <div className="flex h-16 w-22 items-center justify-center rounded-lg">
                <img className="h-16 w-22 text-primary-foreground" src={"icon.svg"} alt="Logo" />
              </div>
            </div>

            <div className="flex flex-col items-center gap-5 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
                <MailCheck className="h-8 w-8 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Check your email</h2>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  If <strong>{submittedEmail}</strong> is registered with {appName}, you will receive a password reset link shortly.
                </p>
                <p className="text-xs text-muted-foreground mt-3">
                  Didn't receive the email? Check your spam folder or try again.
                </p>
              </div>
              <Button className="w-full" onClick={() => router.push("/login")}>
                Back to Sign In
              </Button>
            </div>
          </div>
        </div>

        {/* Right — branding panel */}
        <div className="hidden lg:flex flex-1 flex-col justify-center px-14 py-16 bg-primary">
          <h2 className="text-3xl font-bold text-white leading-tight text-balance mb-4">
            Reset your password in seconds.
          </h2>
          <p className="text-base text-white/70 leading-relaxed mb-10 max-w-xlg">
            We'll send you a secure link to create a new password and get back to managing your ISP business.
          </p>

          <div className="grid grid-cols-2 gap-4 max-w-xlg">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-xl bg-white/10 p-5">
                <Icon className="h-5 w-5 text-white mb-3" />
                <p className="text-sm font-semibold text-white mb-1">{title}</p>
                <p className="text-xs text-white/65 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left — form panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 bg-background">
        <div className="w-full max-w-sm">
          {/* Brand */}
          <div className="flex items-center justify-center gap-2 mb-10">
            <div className="flex h-16 w-22 items-center justify-center rounded-lg">
              <img className="h-16 w-22 text-primary-foreground" src={"icon.svg"} alt="Logo" />
            </div>
          </div>

          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-foreground">Forgot Password?</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Enter your email and we'll send you a reset link
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {serverError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="your.email@example.com"
                value={form.email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
              />
              {emailError && <p className="text-xs text-destructive">{emailError}</p>}
            </div>

            <Button type="submit" className="w-full" disabled={loading || !isValid()}>
              {loading ? "Sending..." : "Send Reset Link"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            <Link href="/login" className="inline-flex items-center gap-1 text-primary font-semibold hover:underline">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Sign In
            </Link>
          </p>
        </div>
      </div>

      {/* Right — branding panel */}
      <div className="hidden lg:flex flex-1 flex-col justify-center px-14 py-16 bg-primary">
        <h2 className="text-3xl font-bold text-white leading-tight text-balance mb-4">
          Don't let a forgotten password slow you down.
        </h2>
        <p className="text-base text-white/70 leading-relaxed mb-10 max-w-xlg">
          Get back to managing your network, collecting payments, and growing your ISP business with <strong>{appName}</strong>.
        </p>

        <div className="grid grid-cols-2 gap-4 max-w-xlg">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-xl bg-white/10 p-5">
              <Icon className="h-5 w-5 text-white mb-3" />
              <p className="text-sm font-semibold text-white mb-1">{title}</p>
              <p className="text-xs text-white/65 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}