"use client";

// =============================================================================
// /verify-email — Email Verification Page
// -----------------------------------------------------------------------------
// Shown after a user clicks a verification link from their email.
// Reads token + email from query params, calls verify API, shows result.
//
// Query Params:
//   ?verify=success&email=...  → Show success state
//   ?verify=error&message=...  → Show error state
// =============================================================================

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  XCircle,
  Mail,
  ArrowRight,
  Loader2,
} from "lucide-react";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    const verifyStatus = searchParams.get("verify");
    const emailParam = searchParams.get("email");
    const msgParam = searchParams.get("message");

    if (emailParam) {
      setEmail(decodeURIComponent(emailParam));
    }

    if (verifyStatus === "success") {
      setStatus("success");
      setMessage(
        "Your email has been verified successfully! You can now sign in to your account."
      );
      return;
    }

    if (verifyStatus === "error") {
      setStatus("error");
      switch (msgParam) {
        case "missing_params":
          setMessage("Invalid verification link. Missing required parameters.");
          break;
        case "expired":
          setMessage(
            "This verification link has expired. Please request a new one from the sign-in page."
          );
          break;
        default:
          setMessage(
            "Verification failed. The link may be invalid or expired. Please try again."
          );
      }
      return;
    }

    // If no verify param, try to verify with token and email directly
    const token = searchParams.get("token");
    const emailFromQuery = searchParams.get("email");

    if (token && emailFromQuery) {
      verifyToken(token, decodeURIComponent(emailFromQuery));
    } else {
      setStatus("error");
      setMessage("Invalid verification link.");
    }
  }, [searchParams]);

  async function verifyToken(token: string, email: string) {
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token }),
      });

      if (res.ok) {
        setStatus("success");
        setMessage(
          "Your email has been verified successfully! You can now sign in to your account."
        );
        setEmail(email);
      } else {
        const data = await res.json().catch(() => ({}));
        setStatus("error");
        setMessage(data.error || "Verification failed. Please try again.");
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Please check your connection and try again.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl border border-slate-200">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          {status === "loading" && (
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
          )}
          {status === "success" && (
            <CheckCircle2 className="h-16 w-16 text-green-500" />
          )}
          {status === "error" && (
            <XCircle className="h-16 w-16 text-red-500" />
          )}
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-center text-slate-900 mb-3">
          {status === "loading" && "Verifying Your Email..."}
          {status === "success" && "Email Verified!"}
          {status === "error" && "Verification Failed"}
        </h1>

        {/* Message */}
        <p className="text-center text-slate-600 mb-8 leading-relaxed">
          {message}
        </p>

        {/* Actions */}
        <div className="space-y-4">
          {(status === "success" || status === "error") && (
            <>
              <Link
                href="/"
                className="flex items-center justify-center gap-2 w-full bg-primary text-white font-semibold py-3 px-4 rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Mail className="h-5 w-5" />
                Go to Sign In
                <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              </Link>

              {status === "error" && (
                <p className="text-center text-sm text-slate-500">
                  Need help?{" "}
                  <Link
                    href="/"
                    className="font-medium text-primary hover:underline"
                  >
                    Request a new verification link
                  </Link>
                </p>
              )}

              {email && status === "success" && (
                <p className="text-center text-sm text-slate-500">
                  Signed in as{" "}
                  <span className="font-medium text-slate-700">{email}</span>
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
