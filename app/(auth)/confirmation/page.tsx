"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const resetPassword = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api"}/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
      });
      redirect(res.ok);
    } catch (err) {
      redirect(false);
    }
  };

  const redirect = (success: boolean) => setTimeout(() => router.push(success ? "/login" : "/reset-password"), 1000);

  useEffect(() => {
    if (!token) {
      redirect(false);
    } else {
      resetPassword();
    }
  }, [token, router, resetPassword]);

  // Circular Progress Component
  const CircularProgress = () => (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="relative w-22 h-22">
        <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
        <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
      </div>
      <p className="text-muted-foreground text-lg mt-4 font-semibold">Confirming password change request...</p>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/20 p-4">
      <div className="py-12">
        <CircularProgress />
      </div>
    </div>
  );
}