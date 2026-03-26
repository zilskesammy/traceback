// app/(auth)/login/page.tsx — Login-Seite mit GitHub OAuth Button

import { signIn } from "@/lib/auth";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;

  if (session?.user) {
    redirect(params.callbackUrl ?? "/dashboard");
  }

  const errorMessages: Record<string, string> = {
    OAuthSignin: "Fehler beim Starten des GitHub Logins.",
    OAuthCallback: "Fehler beim GitHub Callback.",
    OAuthAccountNotLinked:
      "Diese E-Mail ist bereits mit einem anderen Account verknüpft.",
    Configuration: "Server-Konfigurationsfehler. Bitte Administrator kontaktieren.",
    AccessDenied: "Zugriff verweigert.",
    Verification: "Token abgelaufen oder ungültig.",
    default: "Ein Fehler ist aufgetreten. Bitte erneut versuchen.",
  };

  const errorMessage = params.error
    ? (errorMessages[params.error] ?? errorMessages.default)
    : null;

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-sm">
        {/* Logo + Titel */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600 mb-4">
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Traceback
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Planning für Mensch & KI
          </p>
        </div>

        {/* Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-xl">
          <h2 className="text-lg font-semibold text-white mb-1">
            Willkommen zurück
          </h2>
          <p className="text-sm text-gray-400 mb-6">
            Melde dich mit deinem GitHub-Account an.
          </p>

          {/* Fehler-Anzeige */}
          {errorMessage && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-red-950 border border-red-800 text-red-300 text-sm">
              <p>{errorMessage}</p>
              {params.error && (
                <p className="mt-1 text-red-500 text-xs font-mono">Code: {params.error}</p>
              )}
            </div>
          )}

          {/* GitHub Login Button — Server Action */}
          <form
            action={async () => {
              "use server";
              await signIn("github", {
                redirectTo: params.callbackUrl ?? "/dashboard",
              });
            }}
          >
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-white text-gray-900 font-medium text-sm hover:bg-gray-100 active:bg-gray-200 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {/* GitHub Icon */}
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
              Mit GitHub anmelden
            </button>
          </form>

          <p className="mt-4 text-xs text-center text-gray-500">
            Durch die Anmeldung stimmst du unseren{" "}
            <a href="/docs/legal/terms" className="text-gray-400 hover:text-white underline underline-offset-2">
              Nutzungsbedingungen
            </a>{" "}
            zu.
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-gray-600">
          Traceback — AI-native Project Planning
        </p>
      </div>
    </main>
  );
}
