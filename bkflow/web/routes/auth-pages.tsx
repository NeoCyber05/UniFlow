import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { supabase } from "../lib/supabase";

const AuthForm = ({ mode }: { mode: "sign-in" | "sign-up" }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isSignUp = mode === "sign-up";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const { data, error } = isSignUp
      ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: location.origin } })
      : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setMessage(error.message);
    if (isSignUp && !data.session) return setMessage("Kiểm tra email để xác nhận tài khoản, rồi đăng nhập.");
    navigate("/my/today", { replace: true });
  };

  const google = () =>
    supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin } });

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-6 shadow-sm">
      <h1 className="text-xl font-semibold">{isSignUp ? "Tạo tài khoản" : "Đăng nhập"}</h1>
      <Button type="button" variant="outline" className="w-full" onClick={google}>Tiếp tục với Google</Button>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Mật khẩu</Label>
        <Input id="password" type="password" required minLength={6} autoComplete={isSignUp ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
      <Button type="submit" className="w-full" disabled={busy}>{isSignUp ? "Đăng ký" : "Đăng nhập"}</Button>
      <p className="text-center text-sm text-muted-foreground">
        {isSignUp ? <>Đã có tài khoản? <Link className="underline" to="/sign-in">Đăng nhập</Link></> : <>Chưa có tài khoản? <Link className="underline" to="/sign-up">Đăng ký</Link></>}
      </p>
    </form>
  );
};

export const SignInPage = () => <AuthForm mode="sign-in" />;
export const SignUpPage = () => <AuthForm mode="sign-up" />;
