import { redirect } from "next/navigation";
import Nav from "@/components/Nav";
import TradeAdsWorkspace from "@/components/TradeAdsWorkspace";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ensureDefaultAd } from "@/lib/trade";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) {
    redirect("/login");
  }

  await ensureDefaultAd(user.id);

  return (
    <main className="flex flex-1 flex-col">
      <Nav username={user.username} />
      <div className="tp-shell py-6 pb-14">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="tp-display text-3xl font-bold">
              Trade ads
            </h1>
            <p className="tp-muted mt-1 text-sm">
              Build ads, queue them, rotate every 15 minutes.
            </p>
          </div>
        </div>
        <TradeAdsWorkspace />
      </div>
    </main>
  );
}
