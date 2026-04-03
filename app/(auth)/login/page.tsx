// app/(auth)/login/page.tsx

import { signIn } from "@/lib/auth";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ClipboardList, AlertCircle } from "lucide-react";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;

  if (session?.user) {
    const dest =
      params.callbackUrl && !params.callbackUrl.includes("/login")
        ? params.callbackUrl
        : "/dashboard";
    redirect(dest);
  }

  const errorMessages: Record<string, string> = {
    OAuthSignin: "Fehler beim Starten des GitHub Logins.",
    OAuthCallback: "Fehler beim GitHub Callback.",
    OAuthAccountNotLinked: "Diese E-Mail ist bereits mit einem anderen Account verknüpft.",
    Configuration: "Server-Konfigurationsfehler. Bitte Administrator kontaktieren.",
    AccessDenied: "Zugriff verweigert.",
    Verification: "Token abgelaufen oder ungültig.",
    default: "Ein Fehler ist aufgetreten. Bitte erneut versuchen.",
  };

  const errorMessage = params.error
    ? (errorMessages[params.error] ?? errorMessages.default)
    : null;

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950">
      <div className="w-full max-w-sm px-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600 mb-4">
            <ClipboardList className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 tracking-tight">traceback</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">AI-native Project Tracking</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-1">Willkommen zurück</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
            Melde dich mit deinem GitHub-Account an.
          </p>

          {errorMessage && (
            <div className="mb-5 flex items-start gap-2.5 px-3.5 py-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <p>{errorMessage}</p>
                {params.error && (
                  <p className="mt-0.5 text-xs text-red-500 dark:text-red-500 font-mono">Code: {params.error}</p>
                )}
              </div>
            </div>
          )}

          <form
            action={async () => {
              "use server";
              await signIn("github", { redirectTo: params.callbackUrl ?? "/dashboard" });
            }}
          >
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl bg-gray-900 dark:bg-slate-100 text-white dark:text-slate-900 font-medium text-sm hover:bg-gray-800 dark:hover:bg-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              {/* GitHub brand icon — no lucide equivalent, kept as SVG */}
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              Mit GitHub anmelden
            </button>
          </form>

          <p className="mt-4 text-xs text-center text-gray-400 dark:text-slate-500">
            Durch die Anmeldung stimmst du unseren{" "}
            <a
              href="/docs/legal/terms"
              className="text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 underline underline-offset-2"
            >
              Nutzungsbedingungen
            </a>{" "}
            zu.
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400 dark:text-slate-600">
          traceback — AI-native Project Planning
        </p>
      </div>
    </main>
  );
}
