"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Globe,
  Loader2,
  Lock,
  Mail,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LOCALES, tr, useLocale } from "@/lib/i18n";

import { getStartPath } from "../lib/local-prefs";
import { supabase } from "../lib/supabase";

const translateAuthError = (msg: string): string => {
  if (msg.includes("Invalid login credentials")) return tr("auth.error.invalidCredentials");
  if (msg.includes("User already registered")) return tr("auth.error.alreadyRegistered");
  if (msg.includes("Password should be at least")) return tr("auth.error.passwordMinLength");
  if (msg.includes("rate limit")) return tr("auth.error.rateLimit");
  if (msg.includes("network")) return tr("auth.error.network");
  return msg;
};

interface AuthFormProps {
  mode: "sign-in" | "sign-up";
  next?: string;
  compact?: boolean;
}

export const AuthForm = ({ mode: initialMode, next, compact = false }: AuthFormProps) => {
  const navigate = useNavigate();
  const { locale, setLocale } = useLocale();
  const [currentMode, setCurrentMode] = useState<"sign-in" | "sign-up">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setCurrentMode(initialMode);
  }, [initialMode]);

  const isSignUp = currentMode === "sign-up";

  const handleSwitchMode = (targetMode: "sign-in" | "sign-up") => {
    if (targetMode === currentMode) return;
    setMessage(null);
    setCurrentMode(targetMode);
    if (!compact) {
      const targetUrl = next
        ? `/${targetMode}?next=${encodeURIComponent(next)}`
        : `/${targetMode}`;
      navigate(targetUrl, { replace: true });
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    const { data, error } = isSignUp
      ? await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: location.origin + (next ?? getStartPath()) },
        })
      : await supabase.auth.signInWithPassword({ email, password });

    setBusy(false);

    if (error) {
      return setMessage({ type: "error", text: translateAuthError(error.message) });
    }

    if (isSignUp && !data.session) {
      return setMessage({
        type: "success",
        text: tr("auth.signUpConfirmEmail"),
      });
    }

    navigate(next ?? getStartPath(), { replace: true });
  };

  const google = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: next ? location.origin + next : location.origin + getStartPath() },
      });
      if (error) {
        setMessage({ type: "error", text: translateAuthError(error.message) });
      }
    } catch {
      setMessage({ type: "error", text: tr("auth.error.googleConnect") });
    } finally {
      setBusy(false);
    }
  };

  const cardContent = (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={`relative z-10 w-full ${
        compact ? "max-w-sm" : "max-w-md"
      } rounded-2xl border border-border/80 bg-card/90 backdrop-blur-xl p-6 sm:p-8 shadow-2xl shadow-black/10 dark:shadow-black/40`}
    >
      {/* Language Switcher */}
      <div className="-mt-1 mb-3 flex justify-end">
        <div
          role="group"
          aria-label={tr("auth.languageAria")}
          className="inline-flex items-center gap-0.5 rounded-full border border-border/70 bg-muted/50 p-0.5 text-[11px]"
        >
          <Globe aria-hidden="true" className="ml-1.5 mr-0.5 size-3 text-muted-foreground" />
          {LOCALES.map((item) => {
            const active = locale === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={active}
                onClick={() => setLocale(item.id)}
                className={`cursor-pointer rounded-full px-2 py-0.5 font-medium transition-colors ${
                  active
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Brand Header */}
      <div className="flex flex-col items-center text-center space-y-2 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <img src="/logo.svg" alt="" aria-hidden="true" className="size-9" />
          <span className="text-2xl font-bold tracking-tight text-foreground">uniflow</span>
        </div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          {isSignUp ? tr("auth.headingSignUp") : tr("auth.headingSignIn")}
        </h1>
        <p className="text-xs text-muted-foreground max-w-xs">
          {isSignUp ? tr("auth.subtitleSignUp") : tr("auth.subtitleSignIn")}
        </p>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="grid grid-cols-2 rounded-xl bg-muted/60 p-1 mb-5 text-xs font-semibold">
        <button
          type="button"
          onClick={() => handleSwitchMode("sign-in")}
          className={`relative flex items-center justify-center py-2 rounded-lg transition-colors cursor-pointer ${
            !isSignUp ? "text-foreground font-bold" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {tr("auth.tabSignIn")}
          {!isSignUp && (
            <motion.div
              layoutId="auth-tab-pill"
              className="absolute inset-0 rounded-lg bg-card shadow-xs -z-10"
              transition={{ type: "spring", bounce: 0.15, duration: 0.3 }}
            />
          )}
        </button>
        <button
          type="button"
          onClick={() => handleSwitchMode("sign-up")}
          className={`relative flex items-center justify-center py-2 rounded-lg transition-colors cursor-pointer ${
            isSignUp ? "text-foreground font-bold" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {tr("auth.tabSignUp")}
          {isSignUp && (
            <motion.div
              layoutId="auth-tab-pill"
              className="absolute inset-0 rounded-lg bg-card shadow-xs -z-10"
              transition={{ type: "spring", bounce: 0.15, duration: 0.3 }}
            />
          )}
        </button>
      </div>

      {/* Google OAuth Button */}
      <Button
        type="button"
        variant="outline"
        className="w-full h-10 flex items-center justify-center gap-2.5 rounded-xl border-border/80 font-medium text-xs sm:text-sm hover:bg-muted/60 transition-all hover:border-foreground/20"
        onClick={google}
      >
        <svg className="size-4 shrink-0" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </svg>
        {tr("auth.continueWithGoogle")}
      </Button>

      {/* Divider */}
      <div className="relative my-5 flex items-center justify-center">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border/60" />
        </div>
        <span className="relative bg-card px-3 text-[11px] text-muted-foreground uppercase tracking-wider">
          {tr("auth.orWithEmail")}
        </span>
      </div>

      {/* Main Email/Password Form */}
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-xs font-semibold text-foreground">
            {tr("auth.emailLabel")}
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              placeholder={tr("auth.emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-9 h-10 rounded-xl bg-muted/20 border-border/70 focus-visible:ring-violet-500 text-xs sm:text-sm"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-xs font-semibold text-foreground">
              {tr("auth.passwordLabel")}
            </Label>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              minLength={6}
              autoComplete={isSignUp ? "new-password" : "current-password"}
              placeholder={tr("auth.passwordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-9 pr-9 h-10 rounded-xl bg-muted/20 border-border/70 focus-visible:ring-violet-500 text-xs sm:text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-0.5"
              tabIndex={-1}
              aria-label={showPassword ? tr("auth.hidePasswordAria") : tr("auth.showPasswordAria")}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        {/* Feedback Message */}
        <AnimatePresence mode="wait">
          {message && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -4 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={{ opacity: 0, height: 0, y: -4 }}
              role="alert"
              className={`rounded-xl p-3 text-xs flex items-start gap-2.5 ${
                message.type === "error"
                  ? "bg-destructive/10 text-destructive border border-destructive/20"
                  : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
              }`}
            >
              {message.type === "error" ? (
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed">{message.text}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Submit Button */}
        <Button
          type="submit"
          className="w-full h-10 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold text-xs sm:text-sm shadow-md shadow-violet-600/20 transition-all hover:shadow-lg hover:shadow-violet-600/30 active:scale-[0.99]"
          disabled={busy}
        >
          {busy ? (
            <span className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              {tr("auth.processing")}
            </span>
          ) : isSignUp ? (
            tr("auth.submitSignUp")
          ) : (
            tr("auth.submitSignIn")
          )}
        </Button>
      </form>

      {/* Switch Helper */}
      <p className="mt-5 text-center text-xs text-muted-foreground">
        {isSignUp ? (
          <>
            {tr("auth.alreadyHaveAccount")}{" "}
            <button
              type="button"
              onClick={() => handleSwitchMode("sign-in")}
              className="font-semibold text-primary underline underline-offset-4 hover:text-primary/80 cursor-pointer"
            >
              {tr("auth.switchSignIn")}
            </button>
          </>
        ) : (
          <>
            {tr("auth.noAccountYet")}{" "}
            <button
              type="button"
              onClick={() => handleSwitchMode("sign-up")}
              className="font-semibold text-primary underline underline-offset-4 hover:text-primary/80 cursor-pointer"
            >
              {tr("auth.switchSignUp")}
            </button>
          </>
        )}
      </p>

      {/* Campus footer info */}
      <div className="mt-6 pt-4 border-t border-border/40 text-center">
        <p className="text-[11px] text-muted-foreground/80 flex items-center justify-center gap-1.5">
          <Sparkles className="size-3 text-violet-500" />
          {tr("auth.footerTagline")}
        </p>
      </div>
    </motion.div>
  );

  if (compact) {
    return cardContent;
  }

  return (
    <div className="relative min-h-screen min-h-dvh w-full flex items-center justify-center p-4 sm:p-6 md:p-8 bg-background overflow-hidden">
      {/* Ambient Animated Gradient Orbs */}
      <motion.div
        animate={{ scale: [1, 1.1, 1], opacity: [0.35, 0.5, 0.35] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute -top-32 -left-32 size-96 rounded-full bg-violet-500/20 blur-3xl"
      />
      <motion.div
        animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.45, 0.3] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="pointer-events-none absolute -bottom-32 -right-32 size-96 rounded-full bg-indigo-500/20 blur-3xl"
      />
      <motion.div
        animate={{ scale: [1, 1.08, 1], opacity: [0.2, 0.35, 0.2] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-96 rounded-full bg-pink-500/10 blur-3xl"
      />

      {/* Subtle Pattern Grid */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#94a3b8_1px,transparent_1px)] dark:bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:24px_24px] opacity-30" />

      {cardContent}
    </div>
  );
};

export const SignInPage = () => {
  const [searchParams] = useSearchParams();
  const next = searchParams.get("next") ?? undefined;
  return <AuthForm mode="sign-in" next={next} />;
};

export const SignUpPage = () => {
  const [searchParams] = useSearchParams();
  const next = searchParams.get("next") ?? undefined;
  return <AuthForm mode="sign-up" next={next} />;
};
