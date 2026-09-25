import Image from "next/image";
import LoginForm from "@/features/auth/LoginForm";

export const metadata = { title: "Sign in — Onference TV" };

export default function LoginPage() {
  return (
    <div className="loginwrap">
      <div className="logincard">
        <Image src="/onfnewlogo.png" alt="Onference TV" className="loginlogo"
          width={1068} height={222} priority sizes="240px" />
        <h1>Sign in</h1>
        <p className="lede">Content &amp; commercials portal</p>
        <LoginForm />
      </div>
    </div>
  );
}
