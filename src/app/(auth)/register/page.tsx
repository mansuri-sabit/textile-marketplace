import { Suspense } from "react";
import type { Metadata } from "next";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = { title: "Create an account" };

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="skeleton h-[32rem] rounded-card" />}>
      <RegisterForm />
    </Suspense>
  );
}
