import { redirect } from "next/navigation";

// Uso pessoal: não há mais landing de marketing — a raiz leva direto ao app
// (que redireciona para /login se não estiver autenticado).
export default function Home() {
  redirect("/dashboard");
}
