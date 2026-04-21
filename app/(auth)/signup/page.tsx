"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Eye, EyeOff, CheckCircle2, Shield, Zap, Users, Globe } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { z } from "zod";
import { appName } from "@/lib/utils";

const signupSchema = z.object({
  businessName: z.string().min(2, "Business name must be at least 2 characters"),
  adminName: z.string()
  .min(2, "Full name is required")
  .regex(/^[A-Za-z]+(?: [A-Za-z]+)+$/, "Please enter your full name (first and last name)")
  .transform((val) => val.replace(/\s+/g, " ").trim()),
  adminEmail: z.string().email("Enter a valid email address"),
  
});

type SignupForm = {
  businessName: string;
  adminName: string;
  adminEmail: string;
};

type FormErrors = Partial<Record<keyof SignupForm, string>>;

const DEFAULT_FORM: SignupForm = {
  businessName: "",
  adminName: "",
  adminEmail: "",
};

const FEATURES = [
  { icon: Zap, title: "Quick Setup", desc: "Get your ISP billing running in under 10 minutes." },
  { icon: Shield, title: "Secure & Reliable", desc: "Bank-grade security keeps your data safe at all times." },
  { icon: Users, title: "Multi-tenant Ready", desc: "Scale from one location to hundreds of branches seamlessly." },
  { icon: Globe, title: "Works Everywhere", desc: "Manage your network remotely from any device, anywhere." },
];

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState<SignupForm>(DEFAULT_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, errorMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  function isValid() {
    return signupSchema.safeParse(form).success;
  }

  function setField(key: keyof SignupForm, value: string) {
    setForm(f => ({ ...f, [key]: value }));
    setErrors(e => ({ ...e, [key]: undefined }));
    errorMessage("");
  }

  function validate(): boolean {
    const result = signupSchema.safeParse(form);
    if (!result.success) {
      const errs: FormErrors = {};
      result.error.errors.forEach(e => {
        const field = e.path[0] as keyof SignupForm;
        if (!errs[field]) errs[field] = e.message;
      });
      setErrors(errs);
      return false;
    }
    setErrors({});
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    errorMessage("");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api"}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.businessName,
          adminName: form.adminName,
          adminEmail: form.adminEmail,
        }),
      });
      const {success, message} = await res.json();
      if (!success) errorMessage(message)
      setSuccess(success);
    } catch (err: unknown) {
      errorMessage(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm flex flex-col items-center gap-5 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Account created!</h2>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              Your ISP account for <strong>{form.businessName}</strong> has been set up. You can now sign in.
            </p>
          </div>
          <Button className="w-full" onClick={() => router.push("/login")}>
            Go to Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left — form panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 bg-background overflow-y-auto">
        <div className="w-full max-w-sm">
          {/* Brand */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-lg">
              <img className="h-16 w-16 text-primary-foreground" src={"icon.svg"} />
            </div>
          </div>

          <div className="mb-7 text-center">
            <h1 className="text-2xl font-bold text-foreground">Create your account</h1>
            <p className="text-sm text-muted-foreground mt-1">Set up your ISP billing platform in minutes</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {serverError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="businessName">Business Name</Label>
              <Input
                id="businessName"
                placeholder="e.g. FastNet ISP"
                value={form.businessName}
                onChange={(e) => setField("businessName", e.target.value)}
                autoFocus
              />
              {errors.businessName && <p className="text-xs text-destructive">{errors.businessName}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="adminName">Your Full Name</Label>
              <Input
                id="adminName"
                placeholder="John Doe"
                value={form.adminName}
                onChange={(e) => setField("adminName", e.target.value)}
                autoComplete="adminName"
              />
              {errors.adminName && <p className="text-xs text-destructive">{errors.adminName}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="adminEmail">Email</Label>
              <Input
                id="adminEmail"
                type="email"
                placeholder="your.email@example.com"
                value={form.adminEmail}
                onChange={(e) => setField("adminEmail", e.target.value)}
                autoComplete="adminEmail"
              />
              {errors.adminEmail && <p className="text-xs text-destructive">{errors.adminEmail}</p>}
            </div>

            

            <Button type="submit" className="w-full mt-1" disabled={loading || !isValid()}>
              {loading ? "Creating account…" : "Create Account"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-primary font-semibold hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </div>

      {/* Right — branding panel */}
      <div className="hidden lg:flex flex-1 flex-col justify-center px-14 py-16 bg-primary">
        

        <h2 className="text-4xl font-bold text-white leading-tight text-balance mb-4">
          Your ISP. Your Rules. Your Revenue.
        </h2>
        <p className="text-base text-white/70 leading-relaxed mb-10 max-w-xlg">
          Join hundreds of ISPs using {appName} to automate payments, manage routers and grow subscriber bases effortlessly.
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
